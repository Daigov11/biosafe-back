import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './orders.controller.js'
import { requirePermission } from '../../middleware/auth.js'

export const ordersRouter = Router()

ordersRouter.get('/', asyncHandler(controller.list))
ordersRouter.get('/:id', asyncHandler(controller.getById))
ordersRouter.put('/:id', asyncHandler(controller.update))
ordersRouter.post('/:id/review', requirePermission('order:review'), asyncHandler(controller.review))
ordersRouter.post('/:id/approve', requirePermission('order:approve'), asyncHandler(controller.approve))
ordersRouter.post('/:id/generate-production-order', requirePermission('order:generate-production-order'), asyncHandler(controller.generateProductionOrder))
