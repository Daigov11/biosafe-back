import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './production-orders.controller.js'

export const productionOrdersRouter = Router()

productionOrdersRouter.get('/', asyncHandler(controller.list))
productionOrdersRouter.get('/:id', asyncHandler(controller.getById))
productionOrdersRouter.put('/:id', asyncHandler(controller.update))
productionOrdersRouter.get('/:id/progress', asyncHandler(controller.listProgress))
productionOrdersRouter.put('/:id/materials/:materialId', asyncHandler(controller.updateMaterial))
productionOrdersRouter.put('/:id/signatures', asyncHandler(controller.updateSignatures))
