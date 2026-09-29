import type { RequestHandler, Router } from 'express'
import { can } from './lib/auth/permissions.js'
import { requirePermission, requireResource } from './middleware/auth.js'
import { bomRouter } from './modules/bom/bom.routes.js'
import { catalogsRouter } from './modules/catalogs/catalogs.routes.js'
import { costsRouter } from './modules/costs/costs.routes.js'
import { customersRouter } from './modules/customers/customers.routes.js'
import { dispatchesRouter } from './modules/dispatches/dispatches.routes.js'
import { kitsRouter } from './modules/kits/kits.routes.js'
import { lotsRouter } from './modules/lots/lots.routes.js'
import { ordersRouter } from './modules/orders/orders.routes.js'
import { planningRouter } from './modules/planning/planning.routes.js'
import { productionOrdersRouter } from './modules/production-orders/production-orders.routes.js'
import { productMaterialYieldsRouter } from './modules/product-material-yields/product-material-yields.routes.js'
import { productStandardTimesRouter } from './modules/product-standard-times/product-standard-times.routes.js'
import { productionProgressRouter } from './modules/production-progress/production-progress.routes.js'
import { productsRouter } from './modules/products/products.routes.js'
import { quotesRouter } from './modules/quotes/quotes.routes.js'
import { rawMaterialsRouter } from './modules/raw-materials/raw-materials.routes.js'
import { reportsRouter } from './modules/reports/reports.routes.js'
import { routesRouter } from './modules/routes/routes.routes.js'
import {
  productSanitaryRegistrationsRouter,
  sanitaryRegistrationsRouter,
} from './modules/sanitary-registrations/sanitary-registrations.routes.js'
import { usersRouter } from './modules/users/users.routes.js'

export interface ApiMount {
  path: string
  router: Router
  /** Guarda de acceso a nivel de montaje; los routers pueden sumar permisos más finos. */
  guard: RequestHandler
}

// Costos: cambios de costo, validación de rendimientos (Ingeniería) y consulta de auditoría.
const costsAccess: RequestHandler = (req, res, next) => {
  const role = req.user?.role
  if (role && (can(role, 'costs:manage') || can(role, 'audit:read') || can(role, 'technical:manage'))) {
    return next()
  }
  res.status(role ? 403 : 401).json({ status: 'error', message: 'No tienes permiso para esta acción' })
}

/**
 * TODAS estas rutas exigen sesión (autenticación global en app.ts) y su guarda
 * de acceso. Solo `POST /api/auth/login`, `POST /api/auth/logout` y
 * `GET /api/health` son públicos. El orden importa: las rutas anidadas de
 * producto van antes de `/api/products`.
 */
export const protectedMounts: ApiMount[] = [
  { path: '/api/users', router: usersRouter, guard: requirePermission('users:manage') },
  { path: '/api/costs', router: costsRouter, guard: costsAccess },
  { path: '/api/raw-materials', router: rawMaterialsRouter, guard: requireResource('raw-materials') },
  { path: '/api/products/:id/bom', router: bomRouter, guard: requireResource('bom') },
  { path: '/api/products/:id/standard-times', router: productStandardTimesRouter, guard: requireResource('bom') },
  { path: '/api/products/:id/material-yields', router: productMaterialYieldsRouter, guard: requireResource('bom') },
  { path: '/api/products/:id/sanitary-registrations', router: productSanitaryRegistrationsRouter, guard: requireResource('sanitary-registrations') },
  { path: '/api/products', router: productsRouter, guard: requireResource('products') },
  { path: '/api/routes', router: routesRouter, guard: requireResource('routes') },
  { path: '/api/kits', router: kitsRouter, guard: requireResource('kits') },
  { path: '/api/customers', router: customersRouter, guard: requireResource('customers') },
  { path: '/api/quotes', router: quotesRouter, guard: requireResource('quotes') },
  { path: '/api/orders', router: ordersRouter, guard: requireResource('orders') },
  { path: '/api/lots', router: lotsRouter, guard: requireResource('lots') },
  { path: '/api/production-orders', router: productionOrdersRouter, guard: requireResource('production-orders') },
  { path: '/api/production-progress', router: productionProgressRouter, guard: requireResource('production-progress') },
  { path: '/api/dispatches', router: dispatchesRouter, guard: requireResource('dispatches') },
  { path: '/api/planning', router: planningRouter, guard: requireResource('planning') },
  // Reportes: consulta; las exportaciones (POST) exigen además `reports:export`.
  { path: '/api/reports', router: reportsRouter, guard: requireResource('reports', { allMethodsAsRead: true }) },
  { path: '/api/sanitary-registrations', router: sanitaryRegistrationsRouter, guard: requireResource('sanitary-registrations') },
  { path: '/api', router: catalogsRouter, guard: requireResource('catalogs') },
]
