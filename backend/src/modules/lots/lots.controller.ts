import type { Request, Response } from 'express'
import { z } from 'zod'
import * as dispatchesService from '../dispatches/dispatches.service.js'
import * as lotsService from './lots.service.js'

const codeParamSchema = z.string().trim().min(1)
const idParamSchema = z.coerce.number().int().positive()

export async function list(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined
  const lots = await lotsService.listLots(search)
  res.json(lots)
}

export async function getByCode(req: Request, res: Response) {
  const code = codeParamSchema.parse(req.params.code)
  const lot = await lotsService.getLotByCode(code)

  if (!lot) {
    res.status(404).json({ status: 'error', message: 'Lote no encontrado' })
    return
  }

  res.json(lot)
}

export async function listDispatches(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const dispatches = await dispatchesService.listByLot(id)
  res.json(dispatches)
}
