import { Prisma } from '../../../generated/prisma/index.js'
import { prisma } from '../../lib/prisma.js'
import type {
  CreateProductMaterialYieldInput,
  UpdateProductMaterialYieldInput,
} from '../../schemas/product-material-yield.schema.js'

export class ProductMaterialYieldValidationError extends Error {}

const include = { rawMaterial: true } satisfies Prisma.ProductMaterialYieldInclude

export function listByProduct(productId: number) {
  return prisma.productMaterialYield.findMany({
    where: { productId },
    include,
    orderBy: [{ effectiveFrom: 'desc' }, { sourceGrammage: 'asc' }],
  })
}

async function getProductOrThrow(productId: number) {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    throw new ProductMaterialYieldValidationError('Producto no encontrado')
  }
  if (!product.size) {
    throw new ProductMaterialYieldValidationError(
      'El producto debe tener una talla (size) definida para registrar un rendimiento por rollo',
    )
  }
  return product
}

async function assertRawMaterialExists(rawMaterialId: number) {
  const material = await prisma.rawMaterial.findUnique({ where: { id: rawMaterialId } })
  if (!material) {
    throw new ProductMaterialYieldValidationError('La materia prima seleccionada no existe')
  }
}

export async function createMaterialYield(
  productId: number,
  input: CreateProductMaterialYieldInput,
) {
  const product = await getProductOrThrow(productId)
  await assertRawMaterialExists(input.rawMaterialId)

  try {
    return await prisma.productMaterialYield.create({
      data: {
        productId,
        rawMaterialId: input.rawMaterialId,
        // Derivado del producto, nunca del cliente — ver comentario del schema.
        productSize: product.size!,
        cutWidth: input.cutWidth,
        cutLength: input.cutLength,
        unitsPerRoll: input.unitsPerRoll,
        sourceRollWidth: input.sourceRollWidth,
        sourceRollLength: input.sourceRollLength,
        sourceGrammage: input.sourceGrammage,
        effectiveFrom: input.effectiveFrom,
        notes: input.notes,
        active: input.active,
      },
      include,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ProductMaterialYieldValidationError(
        'Ya existe un rendimiento para esa combinación de producto, materia prima, talla y vigencia',
      )
    }
    throw error
  }
}

export async function updateMaterialYield(
  productId: number,
  id: number,
  input: UpdateProductMaterialYieldInput,
) {
  const existing = await prisma.productMaterialYield.findUnique({ where: { id } })
  if (!existing || existing.productId !== productId) return null

  if (input.rawMaterialId !== undefined) {
    await assertRawMaterialExists(input.rawMaterialId)
  }

  try {
    return await prisma.productMaterialYield.update({
      where: { id },
      data: {
        rawMaterialId: input.rawMaterialId,
        cutWidth: input.cutWidth,
        cutLength: input.cutLength,
        unitsPerRoll: input.unitsPerRoll,
        sourceRollWidth: input.sourceRollWidth,
        sourceRollLength: input.sourceRollLength,
        sourceGrammage: input.sourceGrammage,
        effectiveFrom: input.effectiveFrom,
        notes: input.notes,
        active: input.active,
      },
      include,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ProductMaterialYieldValidationError(
        'Ya existe un rendimiento para esa combinación de producto, materia prima, talla y vigencia',
      )
    }
    throw error
  }
}

export async function deleteMaterialYield(productId: number, id: number) {
  const existing = await prisma.productMaterialYield.findUnique({ where: { id } })
  if (!existing || existing.productId !== productId) return null
  await prisma.productMaterialYield.delete({ where: { id } })
  return existing
}

// ---------------------------------------------------------------------------
// Estimación de rollos requeridos — dato de PLANEAMIENTO, siempre derivado
// en el momento de la consulta. Nunca se persiste ni altera la explosión
// de BOM/ProductionOrderMaterial ni las cantidades de una OP ya generada.
// ---------------------------------------------------------------------------

export interface MaterialYieldEstimate {
  yieldId: number
  rawMaterial: { id: number; code: string; name: string }
  productSize: string
  cutWidth: number | null
  cutLength: number | null
  sourceGrammage: number | null
  unitsPerRoll: number
  quantity: number
  rollsRequired: number
  totalYield: number
  remainingCapacity: number
}

/**
 * Estima cuántos rollos de tela se requieren para producir `quantity`
 * unidades de `productId`, a partir del rendimiento configurado. Cuando el
 * producto tiene más de una tela/gramaje configurado (p.ej. mandil L a
 * 35/40/45g), se prioriza el que coincide con la materia prima que
 * realmente usa la BOM del producto — así se sabe "qué tela se está
 * usando" sin que el planeamiento tenga que adivinar. Si no hay match con
 * la BOM y existe más de una opción activa, no se elige ninguna al azar:
 * se retorna `null` (nunca se inventa cuál está en uso).
 */
export async function computeMaterialYieldEstimate(
  productId: number,
  quantity: number,
): Promise<MaterialYieldEstimate | null> {
  if (quantity <= 0) return null

  const now = new Date()
  const yields = await prisma.productMaterialYield.findMany({
    where: { productId, active: true, effectiveFrom: { lte: now } },
    include,
    orderBy: { effectiveFrom: 'desc' },
  })
  if (yields.length === 0) return null

  const bomHeader = await prisma.bomHeader.findUnique({
    where: { productId },
    include: { items: true },
  })
  const bomRawMaterialIds = new Set(
    (bomHeader?.items ?? [])
      .filter((item) => item.componentType === 'RAW_MATERIAL' && item.rawMaterialId !== null)
      .map((item) => item.rawMaterialId as number),
  )

  const bomMatches = yields.filter((y) => bomRawMaterialIds.has(y.rawMaterialId))
  const selected = bomMatches[0] ?? (yields.length === 1 ? yields[0] : null)
  if (!selected) return null

  const unitsPerRoll = selected.unitsPerRoll
  const rollsRequired = Math.ceil(quantity / unitsPerRoll)
  const totalYield = rollsRequired * unitsPerRoll

  return {
    yieldId: selected.id,
    rawMaterial: {
      id: selected.rawMaterial.id,
      code: selected.rawMaterial.code,
      name: selected.rawMaterial.name,
    },
    productSize: selected.productSize,
    cutWidth: selected.cutWidth ? Number(selected.cutWidth) : null,
    cutLength: selected.cutLength ? Number(selected.cutLength) : null,
    sourceGrammage: selected.sourceGrammage ? Number(selected.sourceGrammage) : null,
    unitsPerRoll,
    quantity,
    rollsRequired,
    totalYield,
    remainingCapacity: totalYield - quantity,
  }
}
