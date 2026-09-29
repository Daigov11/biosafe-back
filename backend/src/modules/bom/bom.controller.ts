import type { Request, Response } from 'express'
import { z } from 'zod'
import { explosionQuerySchema, saveBomSchema } from '../../schemas/bom.schema.js'
import { prisma } from '../../lib/prisma.js'
import { BomValidationError, explodeBom, getBomByProductId, saveBom } from './bom.service.js'

const idParamSchema = z.coerce.number().int().positive()

export async function getBom(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
    return
  }

  const bom = await getBomByProductId(productId)
  res.json(bom ?? { productId, active: true, notes: null, items: [] })
}

export async function putBom(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const data = saveBomSchema.parse(req.body)

  try {
    const bom = await saveBom(productId, data)

    if (!bom) {
      res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
      return
    }

    res.json(bom)
  } catch (error) {
    if (error instanceof BomValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function getExplosion(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const { quantity } = explosionQuerySchema.parse(req.query)

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
    return
  }

  const explosion = await explodeBom(productId, quantity)

  if (!explosion) {
    res.status(404).json({
      status: 'error',
      message: 'El producto no tiene una composición (BOM) registrada',
    })
    return
  }

  res.json(explosion)
}
