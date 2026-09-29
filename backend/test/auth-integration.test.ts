import { execFile } from 'node:child_process'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { protectedMounts } from '../src/api-routes.js'
import { createApp } from '../src/app.js'
import { hashPassword } from '../src/lib/auth/password.js'
import { prisma } from '../src/lib/prisma.js'

/**
 * Integración (requiere MySQL): autenticación, sesión, CSRF, bloqueo, permisos
 * por rol sobre TODAS las rutas registradas y auditoría.
 *
 * La tabla de permisos esperados está escrita AQUÍ de forma independiente
 * (no importa la matriz del código) para que la prueba no sea una tautología.
 */

const ROLES = ['COMERCIAL', 'COSTOS', 'INGENIERIA', 'DIRECCION', 'ADMIN'] as const
type Role = (typeof ROLES)[number]
const ALL: Role[] = [...ROLES]
const PASSWORD = 'clave-integracion-123'
const RUN = `it${Date.now()}`
const email = (role: Role) => `${RUN}-${role.toLowerCase()}@biosafe.test`

// --- Expectativas independientes -------------------------------------------
const READ: Record<string, Role[]> = {
  catalogs: ALL,
  'raw-materials': ['COSTOS', 'INGENIERIA', 'DIRECCION', 'ADMIN'],
  products: ALL,
  bom: ['COSTOS', 'INGENIERIA', 'DIRECCION', 'ADMIN'],
  routes: ALL,
  kits: ALL,
  customers: ALL,
  quotes: ALL,
  orders: ALL,
  lots: ['COMERCIAL', 'INGENIERIA', 'DIRECCION', 'ADMIN'],
  'production-orders': ['INGENIERIA', 'DIRECCION', 'ADMIN'],
  'production-progress': ['INGENIERIA', 'DIRECCION', 'ADMIN'],
  dispatches: ['INGENIERIA', 'DIRECCION', 'ADMIN'],
  planning: ['INGENIERIA', 'DIRECCION', 'ADMIN'],
  reports: ALL,
  'sanitary-registrations': ALL,
  files: ALL,
}
const WRITE: Record<string, Role[]> = {
  catalogs: ['ADMIN'],
  'raw-materials': ['INGENIERIA', 'ADMIN'],
  products: ['INGENIERIA', 'ADMIN'],
  bom: ['INGENIERIA', 'ADMIN'],
  routes: ['INGENIERIA', 'ADMIN'],
  kits: ['INGENIERIA', 'ADMIN'],
  customers: ['COMERCIAL', 'DIRECCION', 'ADMIN'],
  quotes: ['COMERCIAL', 'DIRECCION', 'ADMIN'],
  orders: ['INGENIERIA', 'DIRECCION', 'ADMIN'],
  lots: ['INGENIERIA', 'ADMIN'],
  'production-orders': ['INGENIERIA', 'DIRECCION', 'ADMIN'],
  'production-progress': ['INGENIERIA', 'ADMIN'],
  dispatches: ['INGENIERIA', 'ADMIN'],
  planning: ['INGENIERIA', 'ADMIN'],
  'sanitary-registrations': ['INGENIERIA', 'ADMIN'],
  files: ['INGENIERIA', 'ADMIN'],
}

// Prefijo de ruta → recurso (orden: más específico primero).
const RESOURCE_BY_PREFIX: [string, string][] = [
  ['/api/products/:id/bom', 'bom'],
  ['/api/products/:id/standard-times', 'bom'],
  ['/api/products/:id/material-yields', 'bom'],
  ['/api/products/:id/sanitary-registrations', 'sanitary-registrations'],
  ['/api/products', 'products'],
  ['/api/raw-materials', 'raw-materials'],
  ['/api/routes', 'routes'],
  ['/api/kits', 'kits'],
  ['/api/customers', 'customers'],
  ['/api/quotes', 'quotes'],
  ['/api/orders', 'orders'],
  ['/api/lots', 'lots'],
  ['/api/production-orders', 'production-orders'],
  ['/api/production-progress', 'production-progress'],
  ['/api/dispatches', 'dispatches'],
  ['/api/planning', 'planning'],
  ['/api/reports', 'reports'],
  ['/api/sanitary-registrations', 'sanitary-registrations'],
]

interface RouteSpec {
  method: string
  template: string // con :params
  url: string // params → 1
}

/** Restricción adicional (rutas con permiso especial). Devuelve roles permitidos o undefined. */
function specialRoles(r: RouteSpec): Role[] | undefined {
  const t = r.template
  if (t.startsWith('/api/users')) return ['ADMIN']
  if (t.startsWith('/api/costs')) {
    if (r.method === 'GET') return ['COSTOS', 'DIRECCION', 'ADMIN']
    if (t.endsWith('/validate')) return ['INGENIERIA', 'ADMIN']
    return ['COSTOS', 'ADMIN']
  }
  if (r.method === 'POST' && t === '/api/quotes/:id/approve') return ['DIRECCION', 'ADMIN']
  if (t === '/api/orders/:id/review') return ['INGENIERIA', 'DIRECCION', 'ADMIN']
  if (t === '/api/orders/:id/approve') return ['DIRECCION', 'ADMIN']
  if (t === '/api/orders/:id/generate-production-order') return ['INGENIERIA', 'DIRECCION', 'ADMIN']
  if (r.method === 'POST' && t.startsWith('/api/reports/') && t.endsWith('/export')) {
    return ['COMERCIAL', 'INGENIERIA', 'DIRECCION', 'ADMIN']
  }
  return undefined
}

function expectedRoles(r: RouteSpec): Role[] {
  const special = specialRoles(r)
  if (r.template.startsWith('/api/users') || r.template.startsWith('/api/costs')) return special!
  const resource =
    RESOURCE_BY_PREFIX.find(([prefix]) => r.template.startsWith(prefix))?.[1] ?? 'catalogs'
  const isReport = resource === 'reports'
  const isRead = r.method === 'GET' || isReport // exportar (POST) es lectura de reportes
  let allowed = (isRead ? READ : WRITE)[resource]
  // Adjuntos: además exigen el recurso `files`.
  if (r.template.includes('/documents')) {
    const files = r.method === 'GET' ? READ.files : WRITE.files
    allowed = allowed.filter((x) => files.includes(x))
  }
  if (special) allowed = allowed.filter((x) => special.includes(x))
  return allowed
}

function collectRoutes(): RouteSpec[] {
  const out: RouteSpec[] = []
  for (const mount of protectedMounts) {
    const stack = (mount.router as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack
    for (const layer of stack) {
      if (!layer.route) continue
      for (const method of Object.keys(layer.route.methods)) {
        const sub = layer.route.path === '/' ? '' : layer.route.path
        const template = `${mount.path}${sub}`
        out.push({ method: method.toUpperCase(), template, url: template.replace(/:\w+/g, '1') })
      }
    }
  }
  return out
}

// --- Infra -----------------------------------------------------------------
let server: Server
let base = ''
const sessions = {} as Record<Role, { cookie: string; csrf: string }>

async function call(
  method: string,
  url: string,
  opts: { cookie?: string; csrf?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {}
  if (opts.cookie) headers.cookie = opts.cookie
  if (opts.csrf) headers['x-csrf-token'] = opts.csrf
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  return fetch(`${base}${url}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    redirect: 'manual',
  })
}

async function login(userEmail: string, password = PASSWORD) {
  const res = await call('POST', '/api/auth/login', { body: { email: userEmail, password } })
  const setCookie = res.headers.getSetCookie()
  const raw = setCookie.find((c) => c.startsWith('biosafe_session='))
  const body = res.status === 200 ? await res.json() : await res.json().catch(() => ({}))
  return { res, setCookie, cookie: raw?.split(';')[0] ?? '', csrf: (body as { csrfToken?: string }).csrfToken ?? '', body }
}

beforeAll(async () => {
  for (const role of ROLES) {
    await prisma.user.create({
      data: { email: email(role), name: `IT ${role}`, role, passwordHash: hashPassword(PASSWORD) },
    })
  }
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  for (const role of ROLES) {
    const { cookie, csrf } = await login(email(role))
    sessions[role] = { cookie, csrf }
  }
})

afterAll(async () => {
  await new Promise((r) => server.close(r))
  await prisma.auditLog.deleteMany({ where: { userEmail: { startsWith: RUN } } })
  await prisma.serviceCost.deleteMany({ where: { code: { startsWith: RUN } } })
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } })
  await prisma.$disconnect()
})

const routes = collectRoutes()

describe('rutas públicas (solo login, logout y health)', () => {
  it('descubre las rutas registradas (no es una prueba vacía)', () => {
    expect(routes.length).toBeGreaterThan(80)
  })

  it('GET /api/health es público y no expone detalles', async () => {
    const res = await call('GET', '/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', database: 'connected' })
  })

  it('login existe sin sesión (400 por datos vacíos, no 401) y logout es idempotente', async () => {
    expect((await call('POST', '/api/auth/login', { body: {} })).status).toBe(400)
    const out = await call('POST', '/api/auth/logout')
    expect(out.status).toBe(204)
  })

  it('cualquier otra ruta bajo /api sin sesión → 401, incluso inexistentes', async () => {
    expect((await call('GET', '/api/no-existe')).status).toBe(401)
    expect((await call('GET', '/api/auth/me')).status).toBe(401)
    expect((await call('POST', '/api/auth/change-password', { body: {} })).status).toBe(401)
  })
})

describe('TODAS las rutas protegidas sin sesión → 401', () => {
  for (const r of routes) {
    it(`${r.method} ${r.template}`, async () => {
      const res = await call(r.method, r.url, r.method === 'GET' ? {} : { body: {} })
      expect(res.status).toBe(401)
    })
  }
})

describe('escrituras exigen token CSRF (aun con sesión de administrador)', () => {
  const mutating = routes.filter((r) => r.method !== 'GET')
  it('hay rutas de escritura que probar', () => expect(mutating.length).toBeGreaterThan(30))
  for (const r of mutating) {
    it(`${r.method} ${r.template} sin CSRF → 403`, async () => {
      const res = await call(r.method, r.url, { cookie: sessions.ADMIN.cookie, body: {} })
      expect(res.status).toBe(403)
    })
  }
  it('CSRF de otra sesión → 403', async () => {
    const res = await call('POST', '/api/customers', { cookie: sessions.ADMIN.cookie, csrf: sessions.COMERCIAL.csrf, body: {} })
    expect(res.status).toBe(403)
  })
  it('con CSRF correcto pasa la autenticación (la validación de datos responde 400)', async () => {
    const res = await call('POST', '/api/customers', { ...sessions.COMERCIAL, body: {} })
    expect(res.status).toBe(400)
  })
})

describe('permisos por rol en cada ruta (lectura, escritura, aprobación, exportación, archivos)', () => {
  for (const r of routes) {
    const allowed = expectedRoles(r)
    for (const role of ROLES) {
      const ok = allowed.includes(role)
      // Rutas de escritura permitidas no se ejecutan (evita efectos); se prueba solo su denegación.
      if (ok && r.method !== 'GET') continue
      it(`${r.method} ${r.template} · ${role} → ${ok ? 'permitido' : '403'}`, async () => {
        const res = await call(r.method, r.url, { ...sessions[role], body: r.method === 'GET' ? undefined : {} })
        if (ok) expect([401, 403]).not.toContain(res.status)
        else expect(res.status).toBe(403)
      })
    }
  }
})

describe('sesión: cookie, logout, expiración, bloqueo', () => {
  it('la cookie es HttpOnly, SameSite=Lax, con vigencia y el cuerpo NO trae el token de sesión', async () => {
    const { setCookie, cookie, body } = await login(email('COMERCIAL'))
    const raw = setCookie.find((c) => c.startsWith('biosafe_session='))!
    expect(raw).toContain('HttpOnly')
    expect(raw).toContain('SameSite=Lax')
    expect(raw).toContain('Path=/')
    expect(raw).toContain('Max-Age=43200')
    expect(JSON.stringify(body)).not.toContain(cookie.split('=')[1])
    expect((body as { access: { read: string[] } }).access.read).toContain('quotes')
    expect((body as { user: Record<string, unknown> }).user).not.toHaveProperty('passwordHash')
  })

  it('en producción/COOKIE_SECURE la cookie lleva Secure', async () => {
    process.env.COOKIE_SECURE = 'true'
    try {
      const { setCookie } = await login(email('COMERCIAL'))
      expect(setCookie.find((c) => c.startsWith('biosafe_session='))).toContain('Secure')
    } finally {
      delete process.env.COOKIE_SECURE
    }
  })

  it('la sesión persiste entre peticiones (/me) y devuelve un CSRF estable', async () => {
    const s = await login(email('COSTOS'))
    const me = await call('GET', '/api/auth/me', { cookie: s.cookie })
    expect(me.status).toBe(200)
    expect(((await me.json()) as { csrfToken: string }).csrfToken).toBe(s.csrf)
  })

  it('logout borra la sesión en el servidor y limpia la cookie', async () => {
    const s = await login(email('COMERCIAL'))
    const out = await call('POST', '/api/auth/logout', { cookie: s.cookie })
    expect(out.status).toBe(204)
    expect(out.headers.getSetCookie().join(';')).toContain('Max-Age=0')
    expect((await call('GET', '/api/auth/me', { cookie: s.cookie })).status).toBe(401)
  })

  it('una sesión expirada se rechaza', async () => {
    const s = await login(email('COMERCIAL'))
    await prisma.session.updateMany({ where: { user: { email: email('COMERCIAL') } }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await call('GET', '/api/customers', { cookie: s.cookie })).status).toBe(401)
  })

  it('desactivar al usuario invalida su sesión al instante', async () => {
    const s = await login(email('INGENIERIA'))
    expect((await call('GET', '/api/customers', { cookie: s.cookie })).status).toBe(200)
    await prisma.user.update({ where: { email: email('INGENIERIA') }, data: { active: false } })
    expect((await call('GET', '/api/customers', { cookie: s.cookie })).status).toBe(401)
    expect((await login(email('INGENIERIA'))).res.status).toBe(401)
    await prisma.user.update({ where: { email: email('INGENIERIA') }, data: { active: true } })
  })

  it('un token inventado no autentica', async () => {
    expect((await call('GET', '/api/customers', { cookie: 'biosafe_session=inventado' })).status).toBe(401)
  })

  it('5 intentos fallidos bloquean la cuenta (429) aun con la clave correcta; el mensaje no revela si existe', async () => {
    const target = email('DIRECCION')
    const unknown = await login(`${RUN}-noexiste@biosafe.test`, 'cualquiera-123')
    const wrong = await login(target, 'incorrecta-123')
    expect(unknown.body).toEqual(wrong.body) // mismo mensaje: sin enumeración de usuarios
    for (let i = 0; i < 4; i++) await login(target, 'incorrecta-123')
    expect((await login(target)).res.status).toBe(429)
    // El bloqueo vence: se simula pasando lockedUntil al pasado
    await prisma.user.update({ where: { email: target }, data: { lockedUntil: new Date(Date.now() - 1000) } })
    const ok = await login(target)
    expect(ok.res.status).toBe(200)
    const after = await prisma.user.findUniqueOrThrow({ where: { email: target } })
    expect(after.failedLogins).toBe(0)
  })

  it('cambiar la contraseña cierra las demás sesiones', async () => {
    const a = await login(email('COMERCIAL'))
    const b = await login(email('COMERCIAL'))
    const res = await call('POST', '/api/auth/change-password', { ...b, body: { currentPassword: PASSWORD, newPassword: PASSWORD } })
    expect(res.status).toBe(204)
    expect((await call('GET', '/api/auth/me', { cookie: a.cookie })).status).toBe(401)
    expect((await call('GET', '/api/auth/me', { cookie: b.cookie })).status).toBe(200)
  })
})

describe('auditoría', () => {
  it('crear usuario: registra quién, cuándo, valor nuevo y motivo', async () => {
    const newEmail = `${RUN}-nuevo@biosafe.test`
    const res = await call('POST', '/api/users', {
      ...sessions.ADMIN,
      body: { email: newEmail, name: 'Nuevo', role: 'COMERCIAL', password: 'clave-nuevo-1234', reason: 'Alta de prueba' },
    })
    expect(res.status).toBe(201)
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'USER_CREATE', userEmail: email('ADMIN') }, orderBy: { id: 'desc' } })
    expect(log.reason).toBe('Alta de prueba')
    expect(log.userRole).toBe('ADMIN')
    expect(JSON.stringify(log.newValue)).toContain(newEmail)
    expect(JSON.stringify(log.newValue)).not.toContain('passwordHash')
  })

  it('cambio de rol: valor anterior y nuevo, y cierra sus sesiones', async () => {
    const target = await prisma.user.findUniqueOrThrow({ where: { email: `${RUN}-nuevo@biosafe.test` } })
    const s = await login(target.email, 'clave-nuevo-1234')
    const res = await call('PATCH', `/api/users/${target.id}`, { ...sessions.ADMIN, body: { role: 'COSTOS', reason: 'Cambio de área' } })
    expect(res.status).toBe(200)
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'USER_ROLE_CHANGE', entityId: String(target.id) } })
    expect((log.oldValue as { role: string }).role).toBe('COMERCIAL')
    expect((log.newValue as { role: string }).role).toBe('COSTOS')
    expect((await call('GET', '/api/customers', { cookie: s.cookie })).status).toBe(401)
  })

  it('cambio de costo: exige motivo, crea versión y guarda valor anterior/nuevo; isFixture se ignora', async () => {
    const svc = (extra: object) => ({ code: `${RUN}-ETO`, name: 'ETO', category: 'STERILIZATION', includesTax: true, ...extra })
    const noReason = await call('POST', '/api/costs/services', { ...sessions.COSTOS, body: svc({ price: 31 }) })
    expect(noReason.status).toBe(400)

    const v1 = await call('POST', '/api/costs/services', { ...sessions.COSTOS, body: svc({ price: 31, isFixture: true, reason: 'Tarifa vigente' }) })
    expect(v1.status).toBe(201)
    expect(((await v1.json()) as { isFixture: boolean }).isFixture).toBe(false)
    const v2 = await call('POST', '/api/costs/services', { ...sessions.COSTOS, body: svc({ price: 33.5, effectiveFrom: '2027-01-01', reason: 'Aumento de tarifa' }) })
    expect(v2.status).toBe(201)

    const logs = await prisma.auditLog.findMany({ where: { entity: 'ServiceCost', userEmail: email('COSTOS') }, orderBy: { id: 'asc' } })
    const last = logs[logs.length - 1]
    expect(last.action).toBe('COST_VERSION')
    expect(Number((last.oldValue as { price: string }).price)).toBe(31)
    expect(Number((last.newValue as { price: string }).price)).toBe(33.5)
    expect(last.reason).toBe('Aumento de tarifa')
    expect(last.userRole).toBe('COSTOS')
    expect(await prisma.serviceCost.count({ where: { code: `${RUN}-ETO` } })).toBe(2) // versionado, no sobrescribe
  })

  it('la consulta de auditoría es de Costos/Dirección/Admin, no de Comercial', async () => {
    const { cookie, csrf } = await login(email('COMERCIAL')) // sesión propia: la compartida ya fue expirada arriba
    expect((await call('GET', '/api/costs/audit', { cookie, csrf })).status).toBe(403)
    expect((await call('GET', '/api/costs/audit', sessions.DIRECCION)).status).toBe(200)
  })
})

describe('primer administrador solo por variable de entorno', () => {
  const run = promisify(execFile)
  const script = path.resolve(process.cwd(), 'src/scripts/create-admin.ts')
  const bootstrapEmail = `${RUN}-boot@biosafe.test`

  it('crea el admin con ADMIN_EMAIL/ADMIN_PASSWORD, sin imprimir la clave, y puede iniciar sesión', async () => {
    const { stdout, stderr } = await run('npx', ['tsx', script], {
      env: { ...process.env, ADMIN_EMAIL: bootstrapEmail, ADMIN_PASSWORD: 'clave-bootstrap-9999' },
    })
    expect(stdout + stderr).not.toContain('clave-bootstrap-9999')
    const user = await prisma.user.findUniqueOrThrow({ where: { email: bootstrapEmail } })
    expect(user.role).toBe('ADMIN')
    expect(user.passwordHash).not.toContain('clave-bootstrap-9999')
    expect((await login(bootstrapEmail, 'clave-bootstrap-9999')).res.status).toBe(200)
    expect(await prisma.auditLog.count({ where: { action: 'USER_ADMIN_BOOTSTRAP', userEmail: bootstrapEmail } })).toBe(1)
  }, 60000)

  it('rechaza contraseña corta o ausente', async () => {
    await expect(run('npx', ['tsx', script], { env: { ...process.env, ADMIN_EMAIL: `${RUN}-x@biosafe.test`, ADMIN_PASSWORD: 'corta' } })).rejects.toBeTruthy()
    await expect(run('npx', ['tsx', script], { env: { ...process.env, ADMIN_EMAIL: '', ADMIN_PASSWORD: '' } })).rejects.toBeTruthy()
    expect(await prisma.user.count({ where: { email: `${RUN}-x@biosafe.test` } })).toBe(0)
  }, 60000)
})
