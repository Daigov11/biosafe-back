import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './product-standard-times.controller.js'

// Se monta en /api/products/:id/standard-times con mergeParams para heredar :id.
export const productStandardTimesRouter = Router({ mergeParams: true })

productStandardTimesRouter.get('/', asyncHandler(controller.list))
productStandardTimesRouter.post('/', asyncHandler(controller.create))
productStandardTimesRouter.put('/:standardTimeId', asyncHandler(controller.update))
productStandardTimesRouter.delete('/:standardTimeId', asyncHandler(controller.remove))
