import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './customers.controller.js'

export const customersRouter = Router()

customersRouter.get('/', asyncHandler(controller.list))
customersRouter.post('/', asyncHandler(controller.create))
customersRouter.get('/:id', asyncHandler(controller.getById))
customersRouter.put('/:id', asyncHandler(controller.update))
