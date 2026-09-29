import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './quotes.controller.js'
import { requirePermission } from '../../middleware/auth.js'

export const quotesRouter = Router()

quotesRouter.get('/', asyncHandler(controller.list))
quotesRouter.post('/', asyncHandler(controller.create))
quotesRouter.get('/:id', asyncHandler(controller.getById))
quotesRouter.put('/:id', asyncHandler(controller.update))
quotesRouter.post('/:id/approve', requirePermission('quote:approve'), asyncHandler(controller.approve))
