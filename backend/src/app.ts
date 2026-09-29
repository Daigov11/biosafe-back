import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { prisma } from './lib/prisma.js'
import { protectedMounts } from './api-routes.js'
import { authenticate } from './middleware/auth.js'
import { errorHandler } from './middleware/error-handler.js'
import { authRouter } from './modules/auth/auth.routes.js'

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(
    cors({
      origin: (origin, callback) => {
        // Peticiones sin Origin (curl, health checks, server-to-server) no pasan por CORS del navegador.
        callback(null, !origin || allowedOrigins.includes(origin))
      },
      // La sesión viaja en cookie HttpOnly: el navegador solo la envía con credentials.
      credentials: true,
    }),
  )
  app.use(express.json())
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    next()
  })
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  // --- ÚNICAS rutas públicas: health, login y logout -----------------------
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ status: 'ok', database: 'connected' })
    } catch (error) {
      // Público: no se expone el detalle del error, solo se registra.
      console.error('health check falló', error)
      res.status(503).json({ status: 'error', database: 'disconnected' })
    }
  })
  // login/logout son públicos; /me y /change-password exigen sesión dentro del router.
  app.use('/api/auth', authRouter)

  // --- Todo lo demás bajo /api exige sesión (401 sin ella) ------------------
  app.use('/api', authenticate)
  for (const mount of protectedMounts) {
    app.use(mount.path, mount.guard, mount.router)
  }

  app.use((_req, res) => {
    res.status(404).json({ status: 'error', message: 'Recurso no encontrado' })
  })

  app.use(errorHandler)

  return app
}
