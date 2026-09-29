import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import * as controller from './planning.controller.js'

export const planningRouter = Router()

planningRouter.get('/lots', asyncHandler(controller.listLots))

planningRouter.get('/capacities', asyncHandler(controller.listCapacities))
planningRouter.post('/capacities', asyncHandler(controller.createCapacity))
planningRouter.put('/capacities/:id', asyncHandler(controller.updateCapacity))

planningRouter.get('/schedules', asyncHandler(controller.listSchedules))
planningRouter.post('/schedules', asyncHandler(controller.generateSchedules))
planningRouter.put('/schedules/:id', asyncHandler(controller.updateSchedule))
planningRouter.post('/schedules/reorder', asyncHandler(controller.reorderSchedules))

planningRouter.get('/plant', asyncHandler(controller.getPlantView))
