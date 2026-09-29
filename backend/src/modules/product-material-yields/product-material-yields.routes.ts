import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './product-material-yields.controller.js'

// Se monta en /api/products/:id/material-yields con mergeParams para heredar :id.
export const productMaterialYieldsRouter = Router({ mergeParams: true })

productMaterialYieldsRouter.get('/', asyncHandler(controller.list))
productMaterialYieldsRouter.post('/', asyncHandler(controller.create))
productMaterialYieldsRouter.put('/:yieldId', asyncHandler(controller.update))
productMaterialYieldsRouter.delete('/:yieldId', asyncHandler(controller.remove))
