import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { prisma } from './lib/prisma.js'
import { errorHandler } from './middleware/error-handler.js'
import { bomRouter } from './modules/bom/bom.routes.js'
import { catalogsRouter } from './modules/catalogs/catalogs.routes.js'
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

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ status: 'ok', database: 'connected' })
    } catch (error) {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        message: error instanceof Error ? error.message : 'unknown error',
      })
    }
  })

  app.use('/api/raw-materials', rawMaterialsRouter)
  app.use('/api/products/:id/bom', bomRouter)
  app.use('/api/products/:id/standard-times', productStandardTimesRouter)
  app.use('/api/products/:id/material-yields', productMaterialYieldsRouter)
  app.use('/api/products/:id/sanitary-registrations', productSanitaryRegistrationsRouter)
  app.use('/api/products', productsRouter)
  app.use('/api/routes', routesRouter)
  app.use('/api/kits', kitsRouter)
  app.use('/api/customers', customersRouter)
  app.use('/api/quotes', quotesRouter)
  app.use('/api/orders', ordersRouter)
  app.use('/api/lots', lotsRouter)
  app.use('/api/production-orders', productionOrdersRouter)
  app.use('/api/production-progress', productionProgressRouter)
  app.use('/api/dispatches', dispatchesRouter)
  app.use('/api/planning', planningRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api/sanitary-registrations', sanitaryRegistrationsRouter)
  app.use('/api', catalogsRouter)

  app.use((_req, res) => {
    res.status(404).json({ status: 'error', message: 'Recurso no encontrado' })
  })

  app.use(errorHandler)

  return app
}
