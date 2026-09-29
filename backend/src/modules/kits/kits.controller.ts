import type { Request, Response } from 'express'
import * as kitsService from './kits.service.js'

export async function list(_req: Request, res: Response) {
  const items = await kitsService.listKits()
  res.json({ items })
}
