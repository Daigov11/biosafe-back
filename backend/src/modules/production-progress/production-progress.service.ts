import { Prisma } from '../../../generated/prisma/index.js'
import { prisma } from '../../lib/prisma.js'
import type {
  CreateProductionProgressInput,
  ListProductionProgressQuery,
  UpdateProductionProgressInput,
} from '../../schemas/production-progress.schema.js'

export class ProductionProgressValidationError extends Error {}

const progressInclude = {
  routeStep: true,
  productionOrder: { select: { id: true, code: true, status: true } },
  lot: { select: { id: true, lotCode: true } },
} satisfies Prisma.ProductionProgressInclude

/**
 * Regla: un registro de avance solo puede usar un routeStepId que
 * pertenezca a la ruta del producto de la OP/lote (validado siempre
 * contra los pasos reales configurados en esa ruta, no contra códigos
 * fijos).
 */
async function assertRouteStepBelongsToOrder(productionOrderId: number, routeStepId: number) {
  const productionOrder = await prisma.productionOrder.findUnique({
    where: { id: productionOrderId },
    select: {
      lot: { select: { product: { select: { route: { select: { steps: { select: { id: true } } } } } } } },
    },
  })
  if (!productionOrder) {
    throw new ProductionProgressValidationError('Orden de producción no encontrada')
  }
  const validIds = new Set((productionOrder.lot.product.route?.steps ?? []).map((step) => step.id))
  if (!validIds.has(routeStepId)) {
    throw new ProductionProgressValidationError(
      'El paso seleccionado no pertenece a la ruta de esta orden de producción',
    )
  }
}

export async function listByProductionOrder(productionOrderId: number) {
  return prisma.productionProgress.findMany({
    where: { productionOrderId },
    include: progressInclude,
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
  })
}

export async function listProgress(query: ListProductionProgressQuery) {
  const where: Prisma.ProductionProgressWhereInput = {
    AND: [
      query.productionOrderId ? { productionOrderId: query.productionOrderId } : {},
      query.lotId ? { lotId: query.lotId } : {},
      query.dateFrom ? { date: { gte: query.dateFrom } } : {},
      query.dateTo ? { date: { lte: query.dateTo } } : {},
      query.productionOrderStatus ? { productionOrder: { status: query.productionOrderStatus } } : {},
    ],
  }

  const [items, total] = await Promise.all([
    prisma.productionProgress.findMany({
      where,
      include: progressInclude,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.productionProgress.count({ where }),
  ])

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
}

export async function createProgress(input: CreateProductionProgressInput) {
  const productionOrder = await prisma.productionOrder.findUnique({
    where: { id: input.productionOrderId },
    select: { id: true, lotId: true },
  })
  if (!productionOrder) {
    throw new ProductionProgressValidationError('Orden de producción no encontrada')
  }

  await assertRouteStepBelongsToOrder(input.productionOrderId, input.routeStepId)

  return prisma.productionProgress.create({
    data: {
      productionOrderId: input.productionOrderId,
      lotId: productionOrder.lotId,
      routeStepId: input.routeStepId,
      date: input.date ?? new Date(),
      quantity: input.quantity,
      notes: input.notes,
    },
    include: progressInclude,
  })
}

export async function updateProgress(id: number, input: UpdateProductionProgressInput) {
  const existing = await prisma.productionProgress.findUnique({ where: { id } })
  if (!existing) return null

  if (input.routeStepId !== undefined) {
    await assertRouteStepBelongsToOrder(existing.productionOrderId, input.routeStepId)
  }

  return prisma.productionProgress.update({
    where: { id },
    data: {
      routeStepId: input.routeStepId,
      date: input.date,
      quantity: input.quantity,
      notes: input.notes,
    },
    include: progressInclude,
  })
}

export async function deleteProgress(id: number) {
  const existing = await prisma.productionProgress.findUnique({ where: { id } })
  if (!existing) return null
  await prisma.productionProgress.delete({ where: { id } })
  return existing
}
