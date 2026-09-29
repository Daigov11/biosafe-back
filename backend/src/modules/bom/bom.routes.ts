import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './bom.controller.js'

// Se monta en /api/products/:id/bom con mergeParams para heredar :id.
export const bomRouter = Router({ mergeParams: true })

bomRouter.get('/', asyncHandler(controller.getBom))
bomRouter.put('/', asyncHandler(controller.putBom))
bomRouter.post('/', asyncHandler(controller.putBom))
bomRouter.get('/explosion', asyncHandler(controller.getExplosion))
