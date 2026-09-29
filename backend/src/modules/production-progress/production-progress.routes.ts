import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './production-progress.controller.js'

export const productionProgressRouter = Router()

productionProgressRouter.get('/', asyncHandler(controller.list))
productionProgressRouter.post('/', asyncHandler(controller.create))
productionProgressRouter.put('/:id', asyncHandler(controller.update))
productionProgressRouter.delete('/:id', asyncHandler(controller.remove))
