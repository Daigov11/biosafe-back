import type { Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '../../../generated/prisma/index.js'
import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from '../../schemas/customer.schema.js'
import * as customersService from './customers.service.js'

const idParamSchema = z.coerce.number().int().positive()

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function list(req: Request, res: Response) {
  const query = listCustomersQuerySchema.parse(req.query)
  const result = await customersService.listCustomers(query)
  res.json(result)
}

export async function getById(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const customer = await customersService.getCustomerById(id)

  if (!customer) {
    res.status(404).json({ status: 'error', message: 'Cliente no encontrado' })
    return
  }

  res.json(customer)
}

export async function create(req: Request, res: Response) {
  const data = createCustomerSchema.parse(req.body)

  try {
    const customer = await customersService.createCustomer(data)
    res.status(201).json(customer)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ status: 'error', message: `El cliente "${data.name}" ya existe` })
      return
    }
    throw error
  }
}

export async function update(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updateCustomerSchema.parse(req.body)

  try {
    const customer = await customersService.updateCustomer(id, data)

    if (!customer) {
      res.status(404).json({ status: 'error', message: 'Cliente no encontrado' })
      return
    }

    res.json(customer)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ status: 'error', message: `El cliente "${data.name}" ya existe` })
      return
    }
    throw error
  }
}
