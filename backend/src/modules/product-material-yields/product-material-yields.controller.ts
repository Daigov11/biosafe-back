import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  createProductMaterialYieldSchema,
  updateProductMaterialYieldSchema,
} from '../../schemas/product-material-yield.schema.js'
import * as service from './product-material-yields.service.js'
import { ProductMaterialYieldValidationError } from './product-material-yields.service.js'

const idParamSchema = z.coerce.number().int().positive()

export async function list(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const items = await service.listByProduct(productId)
  res.json(items)
}

export async function create(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const data = createProductMaterialYieldSchema.parse(req.body)

  try {
    const item = await service.createMaterialYield(productId, data)
    res.status(201).json(item)
  } catch (error) {
    if (error instanceof ProductMaterialYieldValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function update(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const id = idParamSchema.parse(req.params.yieldId)
  const data = updateProductMaterialYieldSchema.parse(req.body)

  try {
    const item = await service.updateMaterialYield(productId, id, data)
    if (!item) {
      res.status(404).json({ status: 'error', message: 'Rendimiento no encontrado' })
      return
    }
    res.json(item)
  } catch (error) {
    if (error instanceof ProductMaterialYieldValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function remove(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const id = idParamSchema.parse(req.params.yieldId)
  const deleted = await service.deleteMaterialYield(productId, id)

  if (!deleted) {
    res.status(404).json({ status: 'error', message: 'Rendimiento no encontrado' })
    return
  }

  res.status(204).send()
}
