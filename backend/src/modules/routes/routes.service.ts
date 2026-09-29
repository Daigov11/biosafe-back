import { Prisma } from '../../../generated/prisma/index.js'
import { prisma } from '../../lib/prisma.js'
import type {
  CreateRouteInput,
  ListRoutesQuery,
  RouteStepInput,
  UpdateRouteInput,
} from '../../schemas/route.schema.js'

export class RouteValidationError extends Error {}

export async function listRoutes(query: ListRoutesQuery) {
  const where: Prisma.RouteWhereInput = {
    AND: [
      query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
            ],
          }
        : {},
      query.active !== undefined ? { active: query.active } : {},
    ],
  }

  const [items, total] = await Promise.all([
    prisma.route.findMany({
      where,
      include: { _count: { select: { steps: true, products: true } } },
      orderBy: { code: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.route.count({ where }),
  ])

  return {
    items: items.map((route) => ({
      ...route,
      stepsCount: route._count.steps,
      productsCount: route._count.products,
      _count: undefined,
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
}

export function getRouteById(id: number) {
  return prisma.route.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { sequence: 'asc' } },
      products: {
        select: { id: true, code: true, name: true, productType: true, active: true },
        orderBy: { code: 'asc' },
      },
    },
  })
}

export function createRoute(data: CreateRouteInput) {
  return prisma.route.create({ data })
}

export async function updateRoute(id: number, data: UpdateRouteInput) {
  const existing = await prisma.route.findUnique({ where: { id } })
  if (!existing) return null

  if (existing.active && data.active === false) {
    const assignedProducts = await prisma.product.count({ where: { routeId: id } })
    if (assignedProducts > 0) {
      throw new RouteValidationError(
        `No se puede desactivar la ruta "${existing.code}": está asignada a ${assignedProducts} producto(s).`,
      )
    }
  }

  return prisma.route.update({ where: { id }, data })
}

export function getRouteSteps(routeId: number) {
  return prisma.routeStep.findMany({ where: { routeId }, orderBy: { sequence: 'asc' } })
}

export async function saveRouteSteps(routeId: number, steps: RouteStepInput[]) {
  const route = await prisma.route.findUnique({ where: { id: routeId } })
  if (!route) return null

  if (route.active && !steps.some((step) => step.active)) {
    throw new RouteValidationError(
      'Una ruta activa debe tener al menos un paso activo.',
    )
  }

  return prisma.$transaction(async (tx) => {
    await tx.routeStep.deleteMany({ where: { routeId } })
    await tx.routeStep.createMany({
      data: steps.map((step) => ({
        routeId,
        code: step.code,
        name: step.name,
        description: step.description,
        sequence: step.sequence,
        active: step.active,
        productionLine: step.productionLine,
      })),
    })
    return tx.routeStep.findMany({ where: { routeId }, orderBy: { sequence: 'asc' } })
  })
}
