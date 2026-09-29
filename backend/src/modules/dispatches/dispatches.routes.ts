import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './dispatches.controller.js'

export const dispatchesRouter = Router()

dispatchesRouter.post('/', asyncHandler(controller.create))
