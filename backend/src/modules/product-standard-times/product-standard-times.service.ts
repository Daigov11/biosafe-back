import { Prisma } from '../../../generated/prisma/index.js'
import { prisma } from '../../lib/prisma.js'
import type {
  CreateProductStandardTimeInput,
  UpdateProductStandardTimeInput,
} from '../../schemas/product-standard-time.schema.js'

export class ProductStandardTimeValidationError extends Error {}

const include = { routeStep: true } satisfies Prisma.ProductStandardTimeInclude

export function listByProduct(productId: number) {
  return prisma.productStandardTime.findMany({
    where: { productId },
    include,
    orderBy: { routeStep: { sequence: 'asc' } },
  })
}

async function assertRouteStepBelongsToProduct(productId: number, routeStepId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { route: { select: { steps: { select: { id: true } } } } },
  })
  if (!product) {
    throw new ProductStandardTimeValidationError('Producto no encontrado')
  }
  const validIds = new Set((product.route?.steps ?? []).map((step) => step.id))
  if (!validIds.has(routeStepId)) {
    throw new ProductStandardTimeValidationError(
      'El paso seleccionado no pertenece a la ruta de este producto',
    )
  }
}

export async function createStandardTime(productId: number, input: CreateProductStandardTimeInput) {
  await assertRouteStepBelongsToProduct(productId, input.routeStepId)
  try {
    return await prisma.productStandardTime.create({
      data: { productId, ...input },
      include,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ProductStandardTimeValidationError('Ya existe un tiempo estándar para ese paso')
    }
    throw error
  }
}

export async function updateStandardTime(
  productId: number,
  id: number,
  input: UpdateProductStandardTimeInput,
) {
  const existing = await prisma.productStandardTime.findUnique({ where: { id } })
  if (!existing || existing.productId !== productId) return null

  if (input.routeStepId !== undefined) {
    await assertRouteStepBelongsToProduct(productId, input.routeStepId)
  }

  try {
    return await prisma.productStandardTime.update({ where: { id }, data: input, include })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ProductStandardTimeValidationError('Ya existe un tiempo estándar para ese paso')
    }
    throw error
  }
}

export async function deleteStandardTime(productId: number, id: number) {
  const existing = await prisma.productStandardTime.findUnique({ where: { id } })
  if (!existing || existing.productId !== productId) return null
  await prisma.productStandardTime.delete({ where: { id } })
  return existing
}
