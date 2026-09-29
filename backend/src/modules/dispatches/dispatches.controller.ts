import type { Request, Response } from 'express'
import { createDispatchSchema } from '../../schemas/dispatch.schema.js'
import * as service from './dispatches.service.js'
import { DispatchValidationError } from './dispatches.service.js'

export async function create(req: Request, res: Response) {
  const data = createDispatchSchema.parse(req.body)

  try {
    const dispatch = await service.createDispatch(data)
    res.status(201).json(dispatch)
  } catch (error) {
    if (error instanceof DispatchValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}
