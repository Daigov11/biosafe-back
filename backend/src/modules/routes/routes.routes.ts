import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './routes.controller.js'

export const routesRouter = Router()

routesRouter.get('/', asyncHandler(controller.list))
routesRouter.post('/', asyncHandler(controller.create))
routesRouter.get('/:id', asyncHandler(controller.getById))
routesRouter.put('/:id', asyncHandler(controller.update))
routesRouter.get('/:id/steps', asyncHandler(controller.getSteps))
routesRouter.put('/:id/steps', asyncHandler(controller.putSteps))
