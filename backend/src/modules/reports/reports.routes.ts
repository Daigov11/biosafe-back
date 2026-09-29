import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './reports.controller.js'
import { requirePermission } from '../../middleware/auth.js'

export const reportsRouter = Router()

reportsRouter.get('/order-status', asyncHandler(controller.getOrderStatus))
reportsRouter.post('/order-status/export', requirePermission('reports:export'), asyncHandler(controller.exportOrderStatus))
reportsRouter.post('/plant-programming/export', requirePermission('reports:export'), asyncHandler(controller.exportPlantProgramming))
reportsRouter.get('/dashboard', asyncHandler(controller.getDashboard))
