import type { Request, Response } from 'express'
import { z } from 'zod'
import { CodeConflictError } from '../../lib/code-generator.js'
import {
  generateProductionOrderSchema,
  listOrdersQuerySchema,
  updateOrderSchema,
} from '../../schemas/order.schema.js'
import * as ordersService from './orders.service.js'
import { OrderValidationError } from './orders.service.js'

const idParamSchema = z.coerce.number().int().positive()

export async function list(req: Request, res: Response) {
  const query = listOrdersQuerySchema.parse(req.query)
  const result = await ordersService.listOrders(query)
  res.json(result)
}

export async function getById(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const order = await ordersService.getOrderById(id)

  if (!order) {
    res.status(404).json({ status: 'error', message: 'Pedido no encontrado' })
    return
  }

  res.json(order)
}

export async function update(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updateOrderSchema.parse(req.body)
  const order = await ordersService.updateOrder(id, data)

  if (!order) {
    res.status(404).json({ status: 'error', message: 'Pedido no encontrado' })
    return
  }

  res.json(order)
}

export async function review(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)

  try {
    const order = await ordersService.reviewOrder(id)
    if (!order) {
      res.status(404).json({ status: 'error', message: 'Pedido no encontrado' })
      return
    }
    res.json(order)
  } catch (error) {
    if (error instanceof OrderValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function approve(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)

  try {
    const order = await ordersService.approveOrder(id)
    if (!order) {
      res.status(404).json({ status: 'error', message: 'Pedido no encontrado' })
      return
    }
    res.json(order)
  } catch (error) {
    if (error instanceof OrderValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function generateProductionOrder(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = generateProductionOrderSchema.parse(req.body ?? {})

  try {
    const result = await ordersService.generateProductionOrders(id, data)
    if (!result) {
      res.status(404).json({ status: 'error', message: 'Pedido no encontrado' })
      return
    }
    res.json(result)
  } catch (error) {
    if (error instanceof OrderValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    if (error instanceof CodeConflictError) {
      res.status(409).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}
