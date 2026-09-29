import type { Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '../../../generated/prisma/index.js'
import {
  createRouteSchema,
  listRoutesQuerySchema,
  saveRouteStepsSchema,
  updateRouteSchema,
} from '../../schemas/route.schema.js'
import * as routesService from './routes.service.js'
import { RouteValidationError } from './routes.service.js'

const idParamSchema = z.coerce.number().int().positive()

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function list(req: Request, res: Response) {
  const query = listRoutesQuerySchema.parse(req.query)
  const result = await routesService.listRoutes(query)
  res.json(result)
}

export async function getById(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const route = await routesService.getRouteById(id)

  if (!route) {
    res.status(404).json({ status: 'error', message: 'Ruta no encontrada' })
    return
  }

  res.json(route)
}

export async function create(req: Request, res: Response) {
  const data = createRouteSchema.parse(req.body)

  try {
    const route = await routesService.createRoute(data)
    res.status(201).json(route)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ status: 'error', message: `El código "${data.code}" ya existe` })
      return
    }
    throw error
  }
}

export async function update(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updateRouteSchema.parse(req.body)

  try {
    const route = await routesService.updateRoute(id, data)

    if (!route) {
      res.status(404).json({ status: 'error', message: 'Ruta no encontrada' })
      return
    }

    res.json(route)
  } catch (error) {
    if (error instanceof RouteValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ status: 'error', message: `El código "${data.code}" ya existe` })
      return
    }
    throw error
  }
}

export async function getSteps(req: Request, res: Response) {
  const routeId = idParamSchema.parse(req.params.id)

  const route = await routesService.getRouteById(routeId)
  if (!route) {
    res.status(404).json({ status: 'error', message: 'Ruta no encontrada' })
    return
  }

  const steps = await routesService.getRouteSteps(routeId)
  res.json({ items: steps })
}

export async function putSteps(req: Request, res: Response) {
  const routeId = idParamSchema.parse(req.params.id)
  const data = saveRouteStepsSchema.parse(req.body)

  try {
    const steps = await routesService.saveRouteSteps(routeId, data.steps)

    if (!steps) {
      res.status(404).json({ status: 'error', message: 'Ruta no encontrada' })
      return
    }

    res.json({ items: steps })
  } catch (error) {
    if (error instanceof RouteValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}
