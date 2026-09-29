import { Prisma } from '../../../generated/prisma/index.js'
import { explodeBom } from '../../modules/bom/bom.service.js'
import { computeMaterialYieldEstimate } from '../../modules/product-material-yields/product-material-yields.service.js'
import { buildCharacteristicsSummary } from '../../lib/product-characteristics.js'
import { prisma } from '../../lib/prisma.js'
import { getProductionOrderStatusSummary } from './status-summary.service.js'
import type {
  UpdateProductionOrderInput,
  UpdateProductionOrderMaterialInput,
  UpdateProductionOrderSignaturesInput,
} from '../../schemas/production-order.schema.js'

const productionOrderListInclude = {
  lot: {
    include: {
      order: { include: { customer: true } },
      product: { include: { route: true } },
    },
  },
} satisfies Prisma.ProductionOrderInclude

export interface ListProductionOrdersQuery {
  search?: string
  status?: string
  page: number
  pageSize: number
}

export async function listProductionOrders(query: ListProductionOrdersQuery) {
  const where: Prisma.ProductionOrderWhereInput = {
    AND: [
      query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { lot: { lotCode: { contains: query.search } } },
              { lot: { product: { name: { contains: query.search } } } },
              { lot: { product: { code: { contains: query.search } } } },
              { lot: { order: { code: { contains: query.search } } } },
              { lot: { order: { customer: { name: { contains: query.search } } } } },
            ],
          }
        : {},
      query.status ? { status: query.status as Prisma.ProductionOrderWhereInput['status'] } : {},
    ],
  }

  const [items, total] = await Promise.all([
    prisma.productionOrder.findMany({
      where,
      include: productionOrderListInclude,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.productionOrder.count({ where }),
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

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

export async function getProductionOrderDetail(id: number) {
  const productionOrder = await prisma.productionOrder.findUnique({
    where: { id },
    include: {
      lot: {
        include: {
          order: { include: { customer: true } },
          orderItem: true,
          product: { include: { family: true, category: true, route: true } },
          labelApproval: true,
          dispatches: { orderBy: [{ date: 'desc' }, { id: 'desc' }] },
        },
      },
      materials: {
        include: { rawMaterial: true },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!productionOrder) return null

  const componentExplosion = await explodeBom(
    productionOrder.lot.productId,
    Number(productionOrder.lot.quantity),
  )

  // Piezas comerciales por kit (sección "13 piezas comerciales", caso PD
  // GLOBAL): ítems de primer nivel del BOM con countsTowardKitPieces =
  // true, sin importar componentType — un indicador químico (RAW_MATERIAL)
  // puede contar y un envoltorio (RAW_MATERIAL) normalmente no.
  const pieceComponents = (componentExplosion?.items ?? []).filter(
    (item) => item.countsTowardKitPieces,
  )
  const totalPieces = round4(pieceComponents.reduce((sum, item) => sum + item.totalRequired, 0))
  const piecesPerKit = componentExplosion?.totalPiecesPerUnit ?? 0

  const productiveMaterials = productionOrder.materials.filter(
    (material) => material.materialClass === 'PRODUCTIVE_MATERIAL',
  )
  const packagingMaterials = productionOrder.materials.filter(
    (material) => material.materialClass === 'PACKAGING_MATERIAL',
  )

  const statusSummary = await getProductionOrderStatusSummary(id)

  // Rendimiento de material (Iteración 12): dato informativo de
  // planeamiento — rollos estimados a partir de `ProductMaterialYield`,
  // nunca usado para alterar `materials`/`ProductionOrderMaterial` (que
  // siguen viniendo siempre de la explosión de BOM). `null` cuando el
  // producto no tiene rendimiento configurado.
  const materialYieldEstimate = await computeMaterialYieldEstimate(
    productionOrder.lot.productId,
    Number(productionOrder.lot.quantity),
  )

  return {
    ...productionOrder,
    lot: {
      ...productionOrder.lot,
      product: {
        ...productionOrder.lot.product,
        characteristicsSummary: buildCharacteristicsSummary(productionOrder.lot.product),
      },
    },
    components: pieceComponents,
    sizeSummary: componentExplosion?.sizeSummary ?? {},
    totalPieces,
    piecesPerKit,
    materialYieldEstimate,
    productiveMaterials,
    packagingMaterials,
    statusSummary,
    dispatches: productionOrder.lot.dispatches,
  }
}

/**
 * Campos operativos editables de la OP (observaciones, marca, fechas de
 * producción/término). Producto, BOM, ruta y cantidades requeridas nunca
 * se editan por aquí — vienen siempre del maestro/lote.
 */
export async function updateProductionOrder(id: number, input: UpdateProductionOrderInput) {
  const existing = await prisma.productionOrder.findUnique({ where: { id } })
  if (!existing) return null
  await prisma.productionOrder.update({ where: { id }, data: input })
  return getProductionOrderDetail(id)
}

export async function updateProductionOrderMaterial(
  productionOrderId: number,
  materialId: number,
  input: UpdateProductionOrderMaterialInput,
) {
  const existing = await prisma.productionOrderMaterial.findUnique({ where: { id: materialId } })
  if (!existing || existing.productionOrderId !== productionOrderId) return null
  await prisma.productionOrderMaterial.update({ where: { id: materialId }, data: input })
  return getProductionOrderDetail(productionOrderId)
}

export async function updateProductionOrderSignatures(
  id: number,
  input: UpdateProductionOrderSignaturesInput,
) {
  const existing = await prisma.productionOrder.findUnique({ where: { id } })
  if (!existing) return null
  await prisma.productionOrder.update({ where: { id }, data: input })
  return getProductionOrderDetail(id)
}
