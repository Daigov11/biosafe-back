import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  updateProductionOrderMaterialSchema,
  updateProductionOrderSchema,
  updateProductionOrderSignaturesSchema,
} from '../../schemas/production-order.schema.js'
import * as productionProgressService from '../production-progress/production-progress.service.js'
import * as productionOrdersService from './production-orders.service.js'

const idParamSchema = z.coerce.number().int().positive()

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .enum(['DRAFT', 'RELEASED', 'IN_PRODUCTION', 'IN_QUALITY', 'COMPLETED', 'CANCELLED'])
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export async function list(req: Request, res: Response) {
  const query = listQuerySchema.parse(req.query)
  const result = await productionOrdersService.listProductionOrders(query)
  res.json(result)
}

export async function getById(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const productionOrder = await productionOrdersService.getProductionOrderDetail(id)

  if (!productionOrder) {
    res.status(404).json({ status: 'error', message: 'Orden de producción no encontrada' })
    return
  }

  res.json(productionOrder)
}

export async function listProgress(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const progress = await productionProgressService.listByProductionOrder(id)
  res.json(progress)
}

export async function update(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updateProductionOrderSchema.parse(req.body)
  const productionOrder = await productionOrdersService.updateProductionOrder(id, data)

  if (!productionOrder) {
    res.status(404).json({ status: 'error', message: 'Orden de producción no encontrada' })
    return
  }

  res.json(productionOrder)
}

export async function updateMaterial(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const materialId = idParamSchema.parse(req.params.materialId)
  const data = updateProductionOrderMaterialSchema.parse(req.body)
  const productionOrder = await productionOrdersService.updateProductionOrderMaterial(
    id,
    materialId,
    data,
  )

  if (!productionOrder) {
    res.status(404).json({ status: 'error', message: 'Material de la OP no encontrado' })
    return
  }

  res.json(productionOrder)
}

export async function updateSignatures(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updateProductionOrderSignaturesSchema.parse(req.body)
  const productionOrder = await productionOrdersService.updateProductionOrderSignatures(id, data)

  if (!productionOrder) {
    res.status(404).json({ status: 'error', message: 'Orden de producción no encontrada' })
    return
  }

  res.json(productionOrder)
}
