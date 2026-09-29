import { prisma } from '../../lib/prisma.js'

export function listLots(search?: string) {
  return prisma.lot.findMany({
    where: search
      ? {
          OR: [
            { lotCode: { contains: search } },
            { order: { customer: { name: { contains: search } } } },
            { product: { name: { contains: search } } },
            { product: { code: { contains: search } } },
          ],
        }
      : undefined,
    include: {
      order: { include: { customer: true } },
      product: true,
    },
    orderBy: { id: 'asc' },
  })
}

export function getLotByCode(lotCode: string) {
  return prisma.lot.findUnique({
    where: { lotCode },
    include: {
      order: { include: { customer: true } },
      orderItem: true,
      product: {
        include: {
          family: true,
          category: true,
          route: true,
          bom: { include: { items: { include: { rawMaterial: true, componentProduct: true } } } },
        },
      },
      referenceLot: true,
      productionOrder: { include: { materials: { include: { rawMaterial: true } } } },
      labelApproval: true,
    },
  })
}
