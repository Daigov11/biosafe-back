import { Router } from 'express'
import { z } from 'zod'
import { assertPasswordPolicy, generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from '../../lib/auth/password.js'
import { describeAccess } from '../../lib/auth/permissions.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { prisma } from '../../lib/prisma.js'
import {
  authenticate,
  clearSessionCookie,
  csrfTokenFor,
  SESSION_HOURS,
  sessionTokenFrom,
  setSessionCookie,
} from '../../middleware/auth.js'

export const authRouter = Router()

const MAX_FAILED_LOGINS = 5
const LOCK_MINUTES = 15
// Hash de relleno: el tiempo de respuesta no revela si el correo existe.
const DUMMY_HASH = hashPassword('dummy-password-for-timing')

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
})

const INVALID = { status: 'error', message: 'Credenciales inválidas' }

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email } })

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      res.status(429).json({ status: 'error', message: 'Cuenta bloqueada temporalmente por intentos fallidos' })
      return
    }

    const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !user.active || !ok) {
      if (user) {
        const failed = user.failedLogins + 1
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
            lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
          },
        })
      }
      res.status(401).json(INVALID)
      return
    }

    const { token, tokenHash } = generateSessionToken()
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000)
    await prisma.$transaction([
      prisma.session.create({ data: { userId: user.id, tokenHash, expiresAt } }),
      prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
      }),
      prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
    ])
    // El token de sesión viaja SOLO en la cookie HttpOnly; el cuerpo lleva el
    // token CSRF (que la página necesita para escribir) y los permisos.
    setSessionCookie(res, token)
    res.json({
      expiresAt,
      csrfToken: csrfTokenFor(token),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      access: describeAccess(user.role),
    })
  }),
)

authRouter.get('/me', authenticate, (req, res) => {
  res.json({
    user: req.user,
    csrfToken: csrfTokenFor(sessionTokenFrom(req)!),
    access: describeAccess(req.user!.role),
  })
})

// Público e idempotente: también limpia la cookie de una sesión ya expirada.
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = sessionTokenFrom(req)
    if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
    clearSessionCookie(res)
    res.status(204).end()
  }),
)

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1).max(200),
})

authRouter.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      res.status(400).json({ status: 'error', message: 'La contraseña actual no es correcta' })
      return
    }
    try {
      assertPasswordPolicy(newPassword)
    } catch (error) {
      res.status(400).json({ status: 'error', message: (error as Error).message })
      return
    }
    // Cambiar la contraseña cierra las demás sesiones.
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } }),
      prisma.session.deleteMany({ where: { userId: user.id, id: { not: req.sessionId! } } }),
    ])
    res.status(204).end()
  }),
)
