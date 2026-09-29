// Matriz de permisos por rol. ADMIN puede todo.
//
// Dos capas:
//  1) Acceso por RECURSO: `read` (GET/HEAD) y `write` (POST/PUT/PATCH/DELETE).
//  2) Permisos ESPECIALES: aprobar, exportar, precios, costos, usuarios.
// Todo endpoint bajo /api exige sesión; solo login, logout y health son públicos.

export type Role = 'COMERCIAL' | 'COSTOS' | 'INGENIERIA' | 'DIRECCION' | 'ADMIN'

export type Resource =
  | 'catalogs'
  | 'raw-materials'
  | 'products'
  | 'bom' // composición, tiempos estándar y rendimientos del producto
  | 'routes'
  | 'kits'
  | 'customers'
  | 'quotes'
  | 'orders'
  | 'lots'
  | 'production-orders'
  | 'production-progress'
  | 'dispatches'
  | 'planning'
  | 'reports'
  | 'sanitary-registrations'
  | 'files' // adjuntos: descarga y carga de documentos

export type Permission =
  | 'quote:draft' // crear y guardar borradores
  | 'quote:send'
  | 'quote:approve'
  | 'quote:margin-change'
  | 'price:override-request'
  | 'price:override-approve'
  | 'order:review'
  | 'order:approve'
  | 'order:generate-production-order'
  | 'reports:export'
  | 'costs:manage' // costos maestros, parámetros y tarifas
  | 'technical:manage' // ficha técnica, BOM, rendimientos, tiempos
  | 'audit:read'
  | 'users:manage'

export const ALL_RESOURCES: readonly Resource[] = [
  'catalogs', 'raw-materials', 'products', 'bom', 'routes', 'kits', 'customers', 'quotes',
  'orders', 'lots', 'production-orders', 'production-progress', 'dispatches', 'planning',
  'reports', 'sanitary-registrations', 'files',
]

interface RoleAccess {
  read: readonly Resource[]
  write: readonly Resource[]
  permissions: readonly Permission[]
}

const TECHNICAL_READ: readonly Resource[] = [
  'catalogs', 'raw-materials', 'products', 'bom', 'routes', 'kits', 'sanitary-registrations', 'files',
]

const ACCESS: Record<Exclude<Role, 'ADMIN'>, RoleAccess> = {
  // Cotiza y da seguimiento comercial. No ve materias primas ni costos maestros.
  COMERCIAL: {
    read: ['catalogs', 'products', 'routes', 'kits', 'customers', 'quotes', 'orders', 'lots', 'reports', 'sanitary-registrations', 'files'],
    write: ['customers', 'quotes'],
    permissions: ['quote:draft', 'quote:send', 'quote:margin-change', 'price:override-request', 'reports:export'],
  },
  // Mantiene costos; lee la ficha técnica y las cotizaciones para costear.
  COSTOS: {
    read: [...TECHNICAL_READ, 'customers', 'quotes', 'orders', 'reports'],
    write: [],
    permissions: ['costs:manage', 'audit:read'],
  },
  // Ingeniería / Dirección Técnica: ficha, BOM, rendimientos, tiempos, planta y OP.
  INGENIERIA: {
    read: [...TECHNICAL_READ, 'customers', 'quotes', 'orders', 'lots', 'production-orders', 'production-progress', 'dispatches', 'planning', 'reports'],
    write: ['raw-materials', 'products', 'bom', 'routes', 'kits', 'sanitary-registrations', 'files', 'orders', 'lots', 'production-orders', 'production-progress', 'dispatches', 'planning'],
    permissions: ['technical:manage', 'order:review', 'order:generate-production-order', 'reports:export'],
  },
  // Dirección / Administración: lee todo, aprueba cotizaciones, precios excepcionales y pedidos.
  DIRECCION: {
    read: ALL_RESOURCES,
    write: ['customers', 'quotes', 'orders', 'production-orders'],
    permissions: [
      'quote:draft', 'quote:approve', 'quote:margin-change', 'price:override-request',
      'price:override-approve', 'order:review', 'order:approve', 'order:generate-production-order',
      'reports:export', 'audit:read',
    ],
  },
}

export type Mode = 'read' | 'write'

export function canAccess(role: Role, resource: Resource, mode: Mode): boolean {
  if (role === 'ADMIN') return true
  return ACCESS[role]?.[mode].includes(resource) ?? false
}

export function can(role: Role, permission: Permission): boolean {
  if (role === 'ADMIN') return true
  return ACCESS[role]?.permissions.includes(permission) ?? false
}

/** Lo que el frontend necesita para ocultar navegación y acciones (no sustituye al backend). */
export function describeAccess(role: Role) {
  const all = role === 'ADMIN'
  return {
    read: all ? [...ALL_RESOURCES] : [...ACCESS[role].read],
    write: all ? [...ALL_RESOURCES] : [...ACCESS[role].write],
    permissions: all ? null : [...ACCESS[role].permissions], // null = todos
  }
}
