import { Prisma } from '../../../generated/prisma/index.js'
import { computeFabricWeightKg } from '../../lib/fabric-weight.js'
import { prisma } from '../../lib/prisma.js'
import type {
  CreateRawMaterialInput,
  ListRawMaterialsQuery,
  UpdateRawMaterialInput,
} from '../../schemas/raw-material.schema.js'

const rawMaterialInclude = {
  family: true,
  category: true,
  purchaseUnit: true,
  inventoryUnit: true,
  consumptionUnit: true,
} satisfies Prisma.RawMaterialInclude

type RawMaterialWithRelations = Prisma.RawMaterialGetPayload<{ include: typeof rawMaterialInclude }>

/**
 * Peso teórico por rollo (nunca persistido): gramaje × ancho × largo del
 * propio material. Distinto de `netWeightPerRollKg`, que es el peso real
 * declarado por el proveedor.
 */
function withTheoreticalWeight<T extends RawMaterialWithRelations>(material: T) {
  const theoreticalWeightKg = computeFabricWeightKg({
    grammage: material.grammage !== null ? Number(material.grammage) : null,
    grammageUnit: material.grammageUnit,
    width: material.width !== null ? Number(material.width) : null,
    widthUnit: material.widthUnit,
    lengthM: material.length !== null ? Number(material.length) : null,
  })
  return { ...material, theoreticalWeightKg }
}

export async function listRawMaterials(query: ListRawMaterialsQuery) {
  const where: Prisma.RawMaterialWhereInput = {
    AND: [
      query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {},
      query.familyId ? { familyId: query.familyId } : {},
      query.categoryId ? { categoryId: query.categoryId } : {},
      query.type ? { type: query.type } : {},
      query.active !== undefined ? { active: query.active } : {},
    ],
  }

  const [items, total] = await Promise.all([
    prisma.rawMaterial.findMany({
      where,
      include: rawMaterialInclude,
      orderBy: { code: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.rawMaterial.count({ where }),
  ])

  return {
    items: items.map(withTheoreticalWeight),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
}

export async function getRawMaterialById(id: number) {
  const material = await prisma.rawMaterial.findUnique({
    where: { id },
    include: rawMaterialInclude,
  })
  return material ? withTheoreticalWeight(material) : null
}

export async function createRawMaterial(data: CreateRawMaterialInput) {
  const material = await prisma.rawMaterial.create({
    data,
    include: rawMaterialInclude,
  })
  return withTheoreticalWeight(material)
}

export async function updateRawMaterial(id: number, data: UpdateRawMaterialInput) {
  const exists = await prisma.rawMaterial.findUnique({ where: { id } })
  if (!exists) return null

  const material = await prisma.rawMaterial.update({
    where: { id },
    data,
    include: rawMaterialInclude,
  })
  return withTheoreticalWeight(material)
}

export async function getRawMaterialUsedInProducts(id: number) {
  const exists = await prisma.rawMaterial.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return null

  const items = await prisma.bomItem.findMany({
    where: { rawMaterialId: id },
    include: { bomHeader: { include: { product: true } } },
    orderBy: { bomHeader: { product: { code: 'asc' } } },
  })

  return items.map((item) => ({
    productId: item.bomHeader.product.id,
    productCode: item.bomHeader.product.code,
    productName: item.bomHeader.product.name,
    quantity: Number(item.quantity),
    unit: item.unit,
    componentClass: item.componentClass,
  }))
}
