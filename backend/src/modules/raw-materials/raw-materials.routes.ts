import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './raw-materials.controller.js'

export const rawMaterialsRouter = Router()

rawMaterialsRouter.get('/', asyncHandler(controller.list))
rawMaterialsRouter.get('/:id', asyncHandler(controller.getById))
rawMaterialsRouter.get('/:id/used-in-products', asyncHandler(controller.usedInProducts))
rawMaterialsRouter.post('/', asyncHandler(controller.create))
rawMaterialsRouter.put('/:id', asyncHandler(controller.update))
