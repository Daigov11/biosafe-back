import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { CodeConflictError } from '../lib/code-generator.js'

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    res.status(400).json({
      status: 'error',
      message: 'Datos inválidos',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  // Red de seguridad global: cualquier controller que olvide capturar
  // CodeConflictError localmente igual responde 409 en vez de 500 — nunca
  // debe parecer un error de servidor una colisión de código ya
  // rechazada correctamente por la capa de creación.
  if (error instanceof CodeConflictError) {
    res.status(409).json({ status: 'error', message: error.message })
    return
  }

  console.error(error)
  res.status(500).json({ status: 'error', message: 'Error interno del servidor' })
}
