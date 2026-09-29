import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './lots.controller.js'

export const lotsRouter = Router()

lotsRouter.get('/', asyncHandler(controller.list))
lotsRouter.get('/:id/dispatches', asyncHandler(controller.listDispatches))
lotsRouter.get('/:code', asyncHandler(controller.getByCode))
