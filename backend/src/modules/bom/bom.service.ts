import { Prisma } from '../../../generated/prisma/index.js'
import { buildCharacteristicsSummary } from '../../lib/product-characteristics.js'
import { prisma } from '../../lib/prisma.js'
import type { SaveBomInput } from '../../schemas/bom.schema.js'

const bomItemInclude = {
  rawMaterial: true,
  componentProduct: true,
} satisfies Prisma.BomItemInclude

const bomHeaderInclude = {
  items: {
    include: bomItemInclude,
    orderBy: { sequence: 'asc' },
  },
} satisfies Prisma.BomHeaderInclude

export class BomValidationError extends Error {}

export function getBomByProductId(productId: number) {
  return prisma.bomHeader.findUnique({
    where: { productId },
    include: bomHeaderInclude,
  })
}

/**
 * Recorre recursivamente la composición de `startProductId` buscando si
 * `targetProductId` aparece en algún nivel. Se usa para detectar que agregar
 * `startProductId` como componente de `targetProductId` no cierre un ciclo
 * (directo o indirecto).
 */
async function subtreeContainsProduct(
  startProductId: number,
  targetProductId: number,
  visited: Set<number> = new Set(),
): Promise<boolean> {
  if (startProductId === targetProductId) return true
  if (visited.has(startProductId)) return false
  visited.add(startProductId)

  const header = await prisma.bomHeader.findUnique({
    where: { productId: startProductId },
    include: { items: true },
  })
  if (!header) return false

  for (const item of header.items) {
    if (item.componentType === 'PRODUCT' && item.componentProductId) {
      if (await subtreeContainsProduct(item.componentProductId, targetProductId, visited)) {
        return true
      }
    }
  }
  return false
}

export async function saveBom(productId: number, data: SaveBomInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return null

  for (const item of data.items) {
    if (item.componentType === 'RAW_MATERIAL') {
      const material = await prisma.rawMaterial.findUnique({
        where: { id: item.rawMaterialId! },
      })
      if (!material) {
        throw new BomValidationError(`La materia prima con id ${item.rawMaterialId} no existe`)
      }
    } else {
      if (item.componentProductId === productId) {
        throw new BomValidationError('Un producto no puede ser componente de sí mismo')
      }

      const componentProduct = await prisma.product.findUnique({
        where: { id: item.componentProductId! },
      })
      if (!componentProduct) {
        throw new BomValidationError(`El producto con id ${item.componentProductId} no existe`)
      }

      const createsCycle = await subtreeContainsProduct(item.componentProductId!, productId)
      if (createsCycle) {
        throw new BomValidationError(
          `Agregar "${componentProduct.code}" como componente crearía un ciclo con "${product.code}"`,
        )
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const header = await tx.bomHeader.upsert({
      where: { productId },
      update: { active: data.active, notes: data.notes },
      create: { productId, active: data.active, notes: data.notes },
    })

    await tx.bomItem.deleteMany({ where: { bomHeaderId: header.id } })

    await tx.bomItem.createMany({
      data: data.items.map((item) => ({
        bomHeaderId: header.id,
        componentType: item.componentType,
        componentClass: item.componentClass,
        rawMaterialId: item.componentType === 'RAW_MATERIAL' ? item.rawMaterialId : null,
        componentProductId: item.componentType === 'PRODUCT' ? item.componentProductId : null,
        quantity: item.quantity,
        unit: item.unit,
        wastePercentage: item.wastePercentage,
        requiredWidth: item.requiredWidth,
        requiredLength: item.requiredLength,
        notes: item.notes,
        sequence: item.sequence,
        required: item.required,
        countsTowardKitPieces: item.countsTowardKitPieces,
      })),
    })

    return tx.bomHeader.findUniqueOrThrow({
      where: { id: header.id },
      include: bomHeaderInclude,
    })
  })
}

export interface BomExplosionItem {
  id: number
  componentType: 'RAW_MATERIAL' | 'PRODUCT'
  componentClass: 'PRODUCTIVE_MATERIAL' | 'PACKAGING_MATERIAL'
  code: string
  name: string
  size: string | null
  quantityPerUnit: number
  unit: string
  wastePercentage: number | null
  totalRequired: number
  totalRequiredWithWaste: number
  requiredWidth: number | null
  requiredLength: number | null
  required: boolean
  sequence: number
  characteristicsSummary: string[]
  countsTowardKitPieces: boolean
}

/**
 * Suma de piezas comerciales de un kit: únicamente los ítems de PRIMER
 * NIVEL del BOM marcados `countsTowardKitPieces = true` (sección "13
 * piezas comerciales", caso PD GLOBAL). No depende de componentType —
 * un indicador químico (RAW_MATERIAL) puede sumar y un envoltorio
 * (RAW_MATERIAL) normalmente no.
 */
export function computeKitPieceTotal(
  items: { quantity: Prisma.Decimal | number; countsTowardKitPieces: boolean }[],
): number {
  return round4(
    items
      .filter((item) => item.countsTowardKitPieces)
      .reduce((sum, item) => sum + Number(item.quantity), 0),
  )
}

export async function explodeBom(productId: number, quantity: number) {
  const header = await getBomByProductId(productId)
  if (!header) return null

  const items: BomExplosionItem[] = header.items.map((item) => {
    const quantityPerUnit = Number(item.quantity)
    const waste = item.wastePercentage ? Number(item.wastePercentage) : 0
    const totalRequired = quantity * quantityPerUnit
    const totalRequiredWithWaste = waste > 0 ? totalRequired * (1 + waste / 100) : totalRequired

    const isRawMaterial = item.componentType === 'RAW_MATERIAL'

    return {
      id: item.id,
      componentType: item.componentType,
      componentClass: item.componentClass,
      code: (isRawMaterial ? item.rawMaterial?.code : item.componentProduct?.code) ?? '',
      name: (isRawMaterial ? item.rawMaterial?.name : item.componentProduct?.name) ?? '',
      size: (!isRawMaterial ? item.componentProduct?.size : null) ?? null,
      quantityPerUnit,
      unit: item.unit,
      wastePercentage: waste || null,
      totalRequired: round4(totalRequired),
      totalRequiredWithWaste: round4(totalRequiredWithWaste),
      requiredWidth: item.requiredWidth ? Number(item.requiredWidth) : null,
      requiredLength: item.requiredLength ? Number(item.requiredLength) : null,
      required: item.required,
      sequence: item.sequence,
      characteristicsSummary:
        !isRawMaterial && item.componentProduct ? buildCharacteristicsSummary(item.componentProduct) : [],
      countsTowardKitPieces: item.countsTowardKitPieces,
    }
  })

  const sizeSummary: Record<string, number> = {}
  for (const item of items) {
    if (item.componentType === 'PRODUCT' && item.size) {
      sizeSummary[item.size] = round4((sizeSummary[item.size] ?? 0) + item.totalRequired)
    }
  }

  const totalPiecesPerUnit = computeKitPieceTotal(header.items)
  const totalKitPieces = round4(totalPiecesPerUnit * quantity)

  return {
    productId,
    quantity,
    items,
    sizeSummary,
    totalPiecesPerUnit,
    totalKitPieces,
  }
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

export interface ConsolidatedMaterialRequirement {
  rawMaterialId: number
  componentClass: 'PRODUCTIVE_MATERIAL' | 'PACKAGING_MATERIAL'
  unit: string
  totalRequired: number
  totalRequiredWithWaste: number
}

/**
 * Explosión multinivel real: recorre recursivamente el BOM de `productId`
 * (bajando por cada componente tipo PRODUCT hasta llegar a materias primas)
 * y consolida las cantidades requeridas por material + clasificación,
 * aplicando la merma de cada ítem de materia prima en el nivel en que
 * aparece. Usada para generar la instantánea operativa de una Orden de
 * Producción (`ProductionOrderMaterial`), no para el explorador de un solo
 * nivel de la pantalla de Composición/BOM (`explodeBom`).
 */
export async function explodeMaterialsMultiLevel(
  productId: number,
  quantity: number,
): Promise<ConsolidatedMaterialRequirement[]> {
  const accumulator = new Map<string, ConsolidatedMaterialRequirement>()

  async function walk(currentProductId: number, multiplier: number, path: Set<number>) {
    if (path.has(currentProductId)) return // ciclo defensivo; no debería ocurrir (se valida en saveBom)
    path.add(currentProductId)

    const header = await prisma.bomHeader.findUnique({
      where: { productId: currentProductId },
      include: { items: true },
    })

    if (header) {
      for (const item of header.items) {
        const itemQuantity = multiplier * Number(item.quantity)

        if (item.componentType === 'RAW_MATERIAL' && item.rawMaterialId) {
          const waste = item.wastePercentage ? Number(item.wastePercentage) : 0
          const withWaste = waste > 0 ? itemQuantity * (1 + waste / 100) : itemQuantity
          const key = `${item.rawMaterialId}-${item.componentClass}`

          const existing = accumulator.get(key)
          if (existing) {
            existing.totalRequired += itemQuantity
            existing.totalRequiredWithWaste += withWaste
          } else {
            accumulator.set(key, {
              rawMaterialId: item.rawMaterialId,
              componentClass: item.componentClass,
              unit: item.unit,
              totalRequired: itemQuantity,
              totalRequiredWithWaste: withWaste,
            })
          }
        } else if (item.componentType === 'PRODUCT' && item.componentProductId) {
          await walk(item.componentProductId, itemQuantity, path)
        }
      }
    }

    path.delete(currentProductId)
  }

  await walk(productId, quantity, new Set())

  return Array.from(accumulator.values()).map((entry) => ({
    ...entry,
    totalRequired: round4(entry.totalRequired),
    totalRequiredWithWaste: round4(entry.totalRequiredWithWaste),
  }))
}
