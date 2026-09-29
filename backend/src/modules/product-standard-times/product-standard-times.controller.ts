import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  createProductStandardTimeSchema,
  updateProductStandardTimeSchema,
} from '../../schemas/product-standard-time.schema.js'
import * as service from './product-standard-times.service.js'
import { ProductStandardTimeValidationError } from './product-standard-times.service.js'

const idParamSchema = z.coerce.number().int().positive()

export async function list(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const items = await service.listByProduct(productId)
  res.json(items)
}

export async function create(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const data = createProductStandardTimeSchema.parse(req.body)

  try {
    const item = await service.createStandardTime(productId, data)
    res.status(201).json(item)
  } catch (error) {
    if (error instanceof ProductStandardTimeValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function update(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const id = idParamSchema.parse(req.params.standardTimeId)
  const data = updateProductStandardTimeSchema.parse(req.body)

  try {
    const item = await service.updateStandardTime(productId, id, data)
    if (!item) {
      res.status(404).json({ status: 'error', message: 'Tiempo estándar no encontrado' })
      return
    }
    res.json(item)
  } catch (error) {
    if (error instanceof ProductStandardTimeValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function remove(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const id = idParamSchema.parse(req.params.standardTimeId)
  const deleted = await service.deleteStandardTime(productId, id)

  if (!deleted) {
    res.status(404).json({ status: 'error', message: 'Tiempo estándar no encontrado' })
    return
  }

  res.status(204).send()
}
