import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import https from 'node:https'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Configuración de "QA" ANTES de cargar la app (CORS se lee al importarla).
const APP_ORIGIN = 'https://app.biosafe.test'
const API_HOST = 'api.biosafe.test'
process.env.CORS_ORIGINS = APP_ORIGIN
process.env.COOKIE_SECURE = 'true'

// La app se importa dentro de beforeAll (después de fijar el entorno de arriba).
type PrismaClient = typeof import('../src/lib/prisma.js').prisma
let prisma: PrismaClient

/**
 * Simula frontend y API en subdominios distintos sobre HTTPS real:
 * servidor TLS (certificado autofirmado con SAN app./api.biosafe.test), peticiones con
 * cabecera `Origin` del frontend y `Host` de la API. Verifica cookie `Secure`, CORS con
 * credenciales, preflight y rechazo de orígenes ajenos.
 *
 * NO puede verificar la decisión same-site del navegador con los dominios reales
 * (ver docs/seguridad-sesion.md): eso se comprueba en QA.
 */

const EMAIL = `https-${Date.now()}@biosafe.test`
const PASSWORD = 'clave-https-12345'
let server: https.Server
let port = 0
let tmp = ''
let opensslOk = true

try {
  execFileSync('openssl', ['version'], { stdio: 'ignore' })
} catch {
  opensslOk = false
}

interface Res {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
  cookies: string[]
}

function request(method: string, url: string, opts: { origin?: string; cookie?: string; csrf?: string; body?: unknown; extra?: Record<string, string> } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { host: `${API_HOST}:${port}`, ...opts.extra }
    if (opts.origin) headers.origin = opts.origin
    if (opts.cookie) headers.cookie = opts.cookie
    if (opts.csrf) headers['x-csrf-token'] = opts.csrf
    const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body)
    if (payload) {
      headers['content-type'] = 'application/json'
      headers['content-length'] = String(Buffer.byteLength(payload))
    }
    const req = https.request(
      { host: '127.0.0.1', port, path: url, method, headers, servername: API_HOST, rejectUnauthorized: false },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body, cookies: res.headers['set-cookie'] ?? [] }),
        )
      },
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

const describeIf = opensslOk ? describe : describe.skip

beforeAll(async () => {
  const { hashPassword } = await import('../src/lib/auth/password.js')
  prisma = (await import('../src/lib/prisma.js')).prisma
  if (!opensslOk) return
  const { createApp } = await import('../src/app.js')
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'biosafe-tls-'))
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', path.join(tmp, 'key.pem'), '-out', path.join(tmp, 'cert.pem'),
    '-subj', `/CN=${API_HOST}`,
    '-addext', `subjectAltName=DNS:${API_HOST},DNS:app.biosafe.test`,
  ], { stdio: 'ignore' })
  await prisma.user.create({ data: { email: EMAIL, name: 'HTTPS', role: 'ADMIN', passwordHash: hashPassword(PASSWORD) } })
  server = https.createServer(
    { key: fs.readFileSync(path.join(tmp, 'key.pem')), cert: fs.readFileSync(path.join(tmp, 'cert.pem')) },
    createApp(),
  )
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  if (server) await new Promise((r) => server.close(r))
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true })
  await prisma.user.deleteMany({ where: { email: EMAIL } })
  await prisma.$disconnect()
})

describeIf('frontend y API en subdominios distintos sobre HTTPS', () => {
  it('preflight desde el frontend: origen exacto, credenciales y cabecera CSRF permitidos', async () => {
    const res = await request('OPTIONS', '/api/customers', {
      origin: APP_ORIGIN,
      extra: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-csrf-token' },
    })
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN) // exacto, nunca "*"
    expect(res.headers['access-control-allow-credentials']).toBe('true')
    expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain('x-csrf-token')
    expect(String(res.headers.vary)).toContain('Origin')
  })

  it('preflight desde un origen ajeno (o http del mismo host) no recibe permiso CORS', async () => {
    for (const origin of ['https://evil.example', 'http://app.biosafe.test', 'https://app.biosafe.test.evil.example']) {
      const res = await request('OPTIONS', '/api/customers', {
        origin,
        extra: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'x-csrf-token' },
      })
      expect(res.headers['access-control-allow-origin'], origin).toBeUndefined()
    }
  })

  let cookie = ''
  let csrf = ''

  it('login desde el frontend: cookie Secure+HttpOnly+SameSite=Lax, host-only, y CORS con credenciales', async () => {
    const res = await request('POST', '/api/auth/login', { origin: APP_ORIGIN, body: { email: EMAIL, password: PASSWORD } })
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
    const raw = res.cookies.find((c) => c.startsWith('biosafe_session='))!
    expect(raw).toContain('Secure')
    expect(raw).toContain('HttpOnly')
    expect(raw).toContain('SameSite=Lax')
    expect(raw.toLowerCase()).not.toContain('domain=') // host-only: no se comparte con otros subdominios
    expect(raw).not.toContain('SameSite=None')
    cookie = raw.split(';')[0]
    csrf = (JSON.parse(res.body) as { csrfToken: string }).csrfToken
    expect(res.body).not.toContain(cookie.split('=')[1]) // el token de sesión no viaja en el cuerpo
  })

  it('lectura autenticada desde el frontend: 200 y el navegador puede leer la respuesta', async () => {
    const res = await request('GET', '/api/customers', { origin: APP_ORIGIN, cookie })
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('con cookie válida pero desde un origen ajeno, la respuesta no es legible por ese sitio', async () => {
    const res = await request('GET', '/api/customers', { origin: 'https://evil.example', cookie })
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it('escritura: sin CSRF 403 (aun con cookie y origen correcto); con CSRF pasa la autenticación', async () => {
    const without = await request('POST', '/api/customers', { origin: APP_ORIGIN, cookie, body: {} })
    expect(without.status).toBe(403)
    const withCsrf = await request('POST', '/api/customers', { origin: APP_ORIGIN, cookie, csrf, body: {} })
    expect(withCsrf.status).toBe(400) // validación de datos, no 401/403
  })

  it('petición forjada desde un sitio ajeno (cookie enviada por el navegador, sin poder leer el CSRF) → 403', async () => {
    const res = await request('POST', '/api/customers', { origin: 'https://evil.example', cookie, body: { name: 'x' } })
    expect(res.status).toBe(403)
  })

  it('logout desde el frontend limpia la cookie con los mismos atributos y revoca la sesión', async () => {
    const out = await request('POST', '/api/auth/logout', { origin: APP_ORIGIN, cookie })
    expect(out.status).toBe(204)
    const cleared = out.cookies.find((c) => c.startsWith('biosafe_session='))!
    expect(cleared).toContain('Max-Age=0')
    expect(cleared).toContain('Secure')
    expect((await request('GET', '/api/auth/me', { origin: APP_ORIGIN, cookie })).status).toBe(401)
  })
})
