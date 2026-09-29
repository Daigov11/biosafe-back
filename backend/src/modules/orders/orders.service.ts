import { Prisma } from '../../../generated/prisma/index.js'
import { explodeMaterialsMultiLevel } from '../../modules/bom/bom.service.js'
import { createWithUniqueCode, generateLotCode, nextSequentialCode } from '../../lib/code-generator.js'
import { prisma } from '../../lib/prisma.js'
import type {
  GenerateProductionOrderInput,
  ListOrdersQuery,
  UpdateOrderInput,
} from '../../schemas/order.schema.js'

export class OrderValidationError extends Error {}

const orderInclude = {
  customer: true,
  quote: true,
  items: {
    include: {
      product: { include: { family: true, category: true, route: true } },
      override: true,
      lot: { include: { productionOrder: true, labelApproval: true } },
    },
    orderBy: { sequence: 'asc' },
  },
} satisfies Prisma.OrderInclude

export async function listOrders(query: ListOrdersQuery) {
  const where: Prisma.OrderWhereInput = {
    AND: [
      query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { customer: { name: { contains: query.search } } },
            ],
          }
        : {},
      query.status ? { status: query.status } : {},
      query.customerId ? { customerId: query.customerId } : {},
    ],
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { customer: true, quote: true, items: true },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.order.count({ where }),
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

export function getOrderById(id: number) {
  return prisma.order.findUnique({ where: { id }, include: orderInclude })
}

/**
 * Campo operativo editable del pedido (N° de orden de compra del cliente).
 * No toca cliente, ítems, cantidades ni cotización de origen.
 */
export async function updateOrder(id: number, input: UpdateOrderInput) {
  const existing = await prisma.order.findUnique({ where: { id } })
  if (!existing) return null
  await prisma.order.update({ where: { id }, data: input })
  return getOrderById(id)
}

/**
 * PENDING_REVIEW → REVIEWED. Idempotente si ya está en REVIEWED o APPROVED.
 */
export async function reviewOrder(id: number) {
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) return null

  if (order.status === 'REVIEWED' || order.status === 'APPROVED') {
    return getOrderById(id)
  }
  if (order.status === 'CANCELLED') {
    throw new OrderValidationError('No se puede revisar un pedido cancelado')
  }

  await prisma.order.update({ where: { id }, data: { status: 'REVIEWED' } })
  return getOrderById(id)
}

/**
 * REVIEWED → APPROVED. Idempotente si ya está APPROVED.
 */
export async function approveOrder(id: number) {
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) return null

  if (order.status === 'APPROVED') {
    return getOrderById(id)
  }
  if (order.status === 'CANCELLED') {
    throw new OrderValidationError('No se puede aprobar un pedido cancelado')
  }
  if (order.status !== 'REVIEWED') {
    throw new OrderValidationError('El pedido debe estar revisado antes de aprobarse')
  }

  await prisma.order.update({ where: { id }, data: { status: 'APPROVED' } })
  return getOrderById(id)
}

/**
 * Regla 2: pedido aprobado → genera Lote + OP de forma transaccional, con
 * explosión multinivel de materia prima consolidada. Evita duplicar
 * lote/OP: los ítems que ya tienen lote se omiten (se retornan como
 * "existing"), solo se generan los que faltan.
 *
 * INVARIANTE: una colisión de código jamás puede mutar un Lote/OP
 * existente. Ambos se crean siempre con `create` (nunca `upsert`) a
 * través de `createWithUniqueCode`. El código de Lote puede venir del
 * usuario (`input.items[].lotCode`) o generarse automáticamente
 * (`generateLotCode`); el de OP siempre se genera automáticamente. Un
 * choque de unicidad en un código generado se resuelve regenerando y
 * reintentando; un choque en un código ingresado por el usuario se
 * rechaza de inmediato con `CodeConflictError` (HTTP 409) sin tocar el
 * registro existente ni el resto de la transacción. Si cualquier ítem
 * falla tras agotar los reintentos (o por un código de usuario en
 * conflicto), toda la operación hace rollback — nunca quedan lote ni OP
 * parciales para otros ítems del mismo pedido.
 */
export async function generateProductionOrders(id: number, input: GenerateProductionOrderInput) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { lot: true } } },
  })
  if (!order) return null

  if (order.status !== 'APPROVED') {
    throw new OrderValidationError(
      'El pedido debe estar aprobado para generar el Lote y la Orden de Producción',
    )
  }

  const lotCodeByItemId = new Map(
    (input.items ?? [])
      .filter((item) => item.lotCode)
      .map((item) => [item.orderItemId, item.lotCode!]),
  )

  const pendingItems = order.items.filter((item) => !item.lot)
  const existingItemIds = order.items.filter((item) => item.lot).map((item) => item.id)

  if (pendingItems.length === 0) {
    const full = await getOrderById(id)
    return { order: full, generatedProductionOrderIds: [], alreadyGenerated: true }
  }

  const generatedProductionOrderIds = await prisma.$transaction(async (tx) => {
    const createdIds: number[] = []

    for (const [index, item] of pendingItems.entries()) {
      const requestedCode = lotCodeByItemId.get(item.id)

      const lot = await createWithUniqueCode({
        uniqueField: 'lotCode',
        userProvidedCode: requestedCode,
        generateCode: (attempt) => generateLotCode('L', index + 1 + attempt),
        conflictMessage: (code) => `El código de lote "${code}" ya existe`,
        create: (lotCode) =>
          tx.lot.create({
            data: {
              lotCode,
              orderId: order.id,
              orderItemId: item.id,
              productId: item.productId,
              quantity: item.quantity,
              status: 'PLANNED',
            },
          }),
      })

      await tx.labelApproval.create({
        data: { lotId: lot.id, status: 'PENDING' },
      })

      const productionOrder = await createWithUniqueCode({
        uniqueField: 'code',
        generateCode: (attempt) => nextSequentialCode('productionOrder', tx, attempt),
        conflictMessage: (code) => `El código de orden de producción "${code}" ya existe`,
        create: (opCode) =>
          tx.productionOrder.create({
            data: {
              code: opCode,
              lotId: lot.id,
              status: 'DRAFT',
            },
          }),
      })

      const materials = await explodeMaterialsMultiLevel(item.productId, Number(item.quantity))

      if (materials.length > 0) {
        await tx.productionOrderMaterial.createMany({
          data: materials.map((material) => ({
            productionOrderId: productionOrder.id,
            rawMaterialId: material.rawMaterialId,
            materialClass: material.componentClass,
            requiredQuantity: material.totalRequiredWithWaste,
            unit: material.unit,
          })),
        })
      }

      createdIds.push(productionOrder.id)
    }

    return createdIds
  })

  const full = await getOrderById(id)
  return {
    order: full,
    generatedProductionOrderIds,
    existingOrderItemIds: existingItemIds,
    alreadyGenerated: false,
  }
}
