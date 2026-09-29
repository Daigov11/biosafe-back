import { prisma } from '../../lib/prisma.js'
import { getProductionOrderStatusSummary } from '../production-orders/status-summary.service.js'
import type { CreateDispatchInput } from '../../schemas/dispatch.schema.js'

export class DispatchValidationError extends Error {}

export async function listByLot(lotId: number) {
  return prisma.dispatch.findMany({
    where: { lotId },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
  })
}

/**
 * Regla: no se puede despachar más de lo registrado como Producto
 * Terminado disponible para el lote (PT acumulado menos lo ya despachado),
 * derivado siempre del resumen de estado de la OP asociada al lote.
 */
export async function createDispatch(input: CreateDispatchInput) {
  const lot = await prisma.lot.findUnique({
    where: { id: input.lotId },
    include: { productionOrder: true },
  })
  if (!lot) {
    throw new DispatchValidationError('Lote no encontrado')
  }

  const availableToDispatch = lot.productionOrder
    ? ((await getProductionOrderStatusSummary(lot.productionOrder.id))?.availableToDispatch ?? 0)
    : 0

  if (input.quantity > availableToDispatch) {
    throw new DispatchValidationError(
      `No se puede despachar ${input.quantity}: solo hay ${availableToDispatch} disponible como Producto Terminado`,
    )
  }

  return prisma.dispatch.create({
    data: {
      lotId: input.lotId,
      date: input.date ?? new Date(),
      quantity: input.quantity,
      guideNumber: input.guideNumber,
      notes: input.notes,
    },
  })
}
