import type { Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '../../../generated/prisma/index.js'
import {
  createRawMaterialSchema,
  listRawMaterialsQuerySchema,
  updateRawMaterialSchema,
} from '../../schemas/raw-material.schema.js'
import * as rawMaterialsService from './raw-materials.service.js'

const idParamSchema = z.coerce.number().int().positive()

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function list(req: Request, res: Response) {
  const query = listRawMaterialsQuerySchema.parse(req.query)
  const result = await rawMaterialsService.listRawMaterials(query)
  res.json(result)
}

export async function getById(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const material = await rawMaterialsService.getRawMaterialById(id)

  if (!material) {
    res.status(404).json({ status: 'error', message: 'Materia prima no encontrada' })
    return
  }

  res.json(material)
}

export async function create(req: Request, res: Response) {
  const data = createRawMaterialSchema.parse(req.body)

  try {
    const material = await rawMaterialsService.createRawMaterial(data)
    res.status(201).json(material)
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
  const data = updateRawMaterialSchema.parse(req.body)

  try {
    const material = await rawMaterialsService.updateRawMaterial(id, data)

    if (!material) {
      res.status(404).json({ status: 'error', message: 'Materia prima no encontrada' })
      return
    }

    res.json(material)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res
        .status(409)
        .json({ status: 'error', message: `El código "${data.code}" ya existe` })
      return
    }
    throw error
  }
}

export async function usedInProducts(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const result = await rawMaterialsService.getRawMaterialUsedInProducts(id)

  if (result === null) {
    res.status(404).json({ status: 'error', message: 'Materia prima no encontrada' })
    return
  }

  res.json({ items: result })
}
