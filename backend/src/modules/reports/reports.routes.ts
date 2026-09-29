import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './reports.controller.js'

export const reportsRouter = Router()

reportsRouter.get('/order-status', asyncHandler(controller.getOrderStatus))
reportsRouter.post('/order-status/export', asyncHandler(controller.exportOrderStatus))
reportsRouter.post('/plant-programming/export', asyncHandler(controller.exportPlantProgramming))
reportsRouter.get('/dashboard', asyncHandler(controller.getDashboard))
