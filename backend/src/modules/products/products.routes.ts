import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './products.controller.js'

export const productsRouter = Router()

productsRouter.get('/', asyncHandler(controller.list))
productsRouter.get('/:id', asyncHandler(controller.getById))
productsRouter.get('/:id/used-in-products', asyncHandler(controller.usedInProducts))
productsRouter.get('/:id/technical-dossier', asyncHandler(controller.getTechnicalDossier))
productsRouter.post('/', asyncHandler(controller.create))
productsRouter.put('/:id', asyncHandler(controller.update))
