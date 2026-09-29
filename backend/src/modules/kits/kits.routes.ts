import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './kits.controller.js'

export const kitsRouter = Router()

kitsRouter.get('/', asyncHandler(controller.list))
