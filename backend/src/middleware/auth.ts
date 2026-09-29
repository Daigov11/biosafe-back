import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { hashSessionToken } from '../lib/auth/password.js'
import { can, canAccess, type Permission, type Resource, type Role } from '../lib/auth/permissions.js'
import { prisma } from '../lib/prisma.js'

export interface AuthUser {
  id: number
  email: string
  name: string
  role: Role
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser
    sessionId?: number
  }
}

// Sesión en cookie HttpOnly: JavaScript de la página no puede leerla (impide
// ROBAR la sesión con XSS, aunque no impide ACTUAR desde la página) y los
// enlaces de descarga `<a href>` la envían solos. Para las escrituras se exige
// además un token CSRF en cabecera, derivado del token de sesión (determinista
// por sesión, no por petición): un sitio ajeno no puede leer la cookie, así que
// no puede calcularlo. Ver docs/seguridad-sesion.md (límites y requisitos).
export const SESSION_COOKIE = 'biosafe_session'
export const CSRF_HEADER = 'x-csrf-token'
export const SESSION_HOURS = 12

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const name = part.slice(0, index).trim()
    if (name) out[name] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return out
}

export function csrfTokenFor(sessionToken: string): string {
  return crypto.createHash('sha256').update(`csrf:${sessionToken}`).digest('hex')
}

function cookieAttributes(maxAgeSeconds: number) {
  const secure = (process.env.COOKIE_SECURE ?? String(process.env.NODE_ENV === 'production')) === 'true'
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`
}

export function setSessionCookie(res: Response, token: string) {
  res.append('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieAttributes(SESSION_HOURS * 3600)}`)
}

export function clearSessionCookie(res: Response) {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttributes(0)}`)
}

export function sessionTokenFrom(req: Request): string | undefined {
  return parseCookies(req.header('cookie'))[SESSION_COOKIE] || undefined
}

function timingSafeEqualStr(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = sessionTokenFrom(req)
  if (!token) {
    res.status(401).json({ status: 'error', message: 'Autenticación requerida' })
    return
  }
  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    })
    if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.active) {
      clearSessionCookie(res)
      res.status(401).json({ status: 'error', message: 'Sesión inválida o expirada' })
      return
    }
    if (!SAFE_METHODS.has(req.method)) {
      const sent = req.header(CSRF_HEADER) ?? ''
      if (!timingSafeEqualStr(sent, csrfTokenFor(token))) {
        res.status(403).json({ status: 'error', message: 'Token CSRF inválido o ausente' })
        return
      }
    }
    const { id, email, name, role } = session.user
    req.user = { id, email, name, role }
    req.sessionId = session.id
    next()
  } catch (error) {
    next(error)
  }
}

function deny(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ status: 'error', message: 'Autenticación requerida' })
  } else {
    res.status(403).json({ status: 'error', message: 'No tienes permiso para esta acción' })
  }
}

export const requirePermission =
  (permission: Permission) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !can(req.user.role, permission)) return deny(req, res)
    next()
  }

/**
 * Acceso por recurso: GET/HEAD/OPTIONS exigen lectura; el resto, escritura.
 * `allMethodsAsRead` es para recursos de solo consulta cuyas exportaciones
 * viajan por POST (reportes): se trata todo como lectura y la exportación
 * exige además `reports:export`.
 */
export const requireResource =
  (resource: Resource, options: { allMethodsAsRead?: boolean } = {}) =>
  (req: Request, res: Response, next: NextFunction) => {
    const mode = options.allMethodsAsRead || SAFE_METHODS.has(req.method) ? 'read' : 'write'
    if (!req.user || !canAccess(req.user.role, resource, mode)) return deny(req, res)
    next()
  }
