import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  createProductionProgressSchema,
  listProductionProgressQuerySchema,
  updateProductionProgressSchema,
} from '../../schemas/production-progress.schema.js'
import * as service from './production-progress.service.js'
import { ProductionProgressValidationError } from './production-progress.service.js'

const idParamSchema = z.coerce.number().int().positive()

export async function list(req: Request, res: Response) {
  const query = listProductionProgressQuerySchema.parse(req.query)
  const result = await service.listProgress(query)
  res.json(result)
}

export async function create(req: Request, res: Response) {
  const data = createProductionProgressSchema.parse(req.body)

  try {
    const progress = await service.createProgress(data)
    res.status(201).json(progress)
  } catch (error) {
    if (error instanceof ProductionProgressValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function update(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updateProductionProgressSchema.parse(req.body)

  try {
    const progress = await service.updateProgress(id, data)

    if (!progress) {
      res.status(404).json({ status: 'error', message: 'Registro de avance no encontrado' })
      return
    }

    res.json(progress)
  } catch (error) {
    if (error instanceof ProductionProgressValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function remove(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const deleted = await service.deleteProgress(id)

  if (!deleted) {
    res.status(404).json({ status: 'error', message: 'Registro de avance no encontrado' })
    return
  }

  res.status(204).send()
}
