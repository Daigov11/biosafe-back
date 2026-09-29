import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  createPlantCapacitySchema,
  generateSchedulesSchema,
  plantViewQuerySchema,
  reorderSchedulesSchema,
  updatePlantCapacitySchema,
  updatePlantScheduleSchema,
} from '../../schemas/planning.schema.js'
import * as service from './planning.service.js'
import { PlanningValidationError } from './planning.service.js'

const idParamSchema = z.coerce.number().int().positive()

export async function listLots(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined
  const lots = await service.searchAvailableLots(search)
  res.json(lots)
}

export async function listCapacities(_req: Request, res: Response) {
  const capacities = await service.listCapacities()
  res.json(capacities)
}

export async function createCapacity(req: Request, res: Response) {
  const data = createPlantCapacitySchema.parse(req.body)
  try {
    const capacity = await service.createCapacity(data)
    res.status(201).json(capacity)
  } catch (error) {
    if (error instanceof PlanningValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function updateCapacity(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updatePlantCapacitySchema.parse(req.body)
  try {
    const capacity = await service.updateCapacity(id, data)
    if (!capacity) {
      res.status(404).json({ status: 'error', message: 'Capacidad no encontrada' })
      return
    }
    res.json(capacity)
  } catch (error) {
    if (error instanceof PlanningValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function listSchedules(_req: Request, res: Response) {
  const schedules = await service.listSchedules()
  res.json(schedules)
}

export async function generateSchedules(req: Request, res: Response) {
  const data = generateSchedulesSchema.parse(req.body)
  const result = await service.generateSchedules(data)
  res.status(201).json(result)
}

export async function updateSchedule(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updatePlantScheduleSchema.parse(req.body)
  const schedule = await service.updateSchedule(id, data)
  if (!schedule) {
    res.status(404).json({ status: 'error', message: 'Programación no encontrada' })
    return
  }
  res.json(schedule)
}

export async function reorderSchedules(req: Request, res: Response) {
  const data = reorderSchedulesSchema.parse(req.body)
  const schedules = await service.reorderSchedules(data)
  res.json(schedules)
}

export async function getPlantView(req: Request, res: Response) {
  const filters = plantViewQuerySchema.parse(req.query)
  const view = await service.getPlantView(filters)
  res.json(view)
}
