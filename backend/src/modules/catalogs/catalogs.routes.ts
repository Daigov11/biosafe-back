import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import { prisma } from '../../lib/prisma.js'

export const catalogsRouter = Router()

catalogsRouter.get(
  '/material-families',
  asyncHandler(async (_req, res) => {
    const items = await prisma.materialFamily.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })
    res.json({ items })
  }),
)

catalogsRouter.get(
  '/material-categories',
  asyncHandler(async (req, res) => {
    const familyId = req.query.familyId ? Number(req.query.familyId) : undefined
    const items = await prisma.materialCategory.findMany({
      where: {
        active: true,
        ...(familyId ? { familyId } : {}),
      },
      orderBy: { name: 'asc' },
    })
    res.json({ items })
  }),
)

catalogsRouter.get(
  '/units',
  asyncHandler(async (_req, res) => {
    const items = await prisma.unit.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })
    res.json({ items })
  }),
)

catalogsRouter.get(
  '/product-families',
  asyncHandler(async (_req, res) => {
    const items = await prisma.productFamily.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })
    res.json({ items })
  }),
)

catalogsRouter.get(
  '/product-categories',
  asyncHandler(async (req, res) => {
    const familyId = req.query.familyId ? Number(req.query.familyId) : undefined
    const items = await prisma.productCategory.findMany({
      where: {
        active: true,
        ...(familyId ? { familyId } : {}),
      },
      orderBy: { name: 'asc' },
    })
    res.json({ items })
  }),
)
