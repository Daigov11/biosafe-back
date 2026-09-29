import type { Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '../../../generated/prisma/index.js'
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from '../../schemas/product.schema.js'
import * as productsService from './products.service.js'

const idParamSchema = z.coerce.number().int().positive()

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function list(req: Request, res: Response) {
  const query = listProductsQuerySchema.parse(req.query)
  const result = await productsService.listProducts(query)
  res.json(result)
}

export async function getById(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const product = await productsService.getProductById(id)

  if (!product) {
    res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
    return
  }

  res.json(product)
}

export async function create(req: Request, res: Response) {
  const data = createProductSchema.parse(req.body)

  try {
    const product = await productsService.createProduct(data)
    res.status(201).json(product)
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
  const data = updateProductSchema.parse(req.body)

  try {
    const product = await productsService.updateProduct(id, data)

    if (!product) {
      res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
      return
    }

    res.json(product)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ status: 'error', message: `El código "${data.code}" ya existe` })
      return
    }
    throw error
  }
}

export async function usedInProducts(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const result = await productsService.getProductUsedInProducts(id)

  if (result === null) {
    res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
    return
  }

  res.json({ items: result })
}

export async function getTechnicalDossier(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const dossier = await productsService.getProductTechnicalDossier(id)

  if (!dossier) {
    res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
    return
  }

  res.json(dossier)
}
