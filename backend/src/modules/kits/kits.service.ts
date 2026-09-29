import { Prisma } from '../../../generated/prisma/index.js'
import { prisma } from '../../lib/prisma.js'

const kitInclude = {
  family: true,
  category: true,
  route: true,
} satisfies Prisma.ProductInclude

export async function listKits() {
  const kits = await prisma.product.findMany({
    where: { productType: 'KIT' },
    include: kitInclude,
    orderBy: { code: 'asc' },
  })

  return Promise.all(
    kits.map(async (kit) => {
      // El total de piezas es la suma de cantidades de ítems del BOM
      // marcados countsTowardKitPieces = true — no depende de componentType:
      // un indicador químico (RAW_MATERIAL) puede sumar y un envoltorio
      // (RAW_MATERIAL) normalmente no.
      const aggregate = await prisma.bomItem.aggregate({
        where: {
          countsTowardKitPieces: true,
          bomHeader: { productId: kit.id },
        },
        _sum: { quantity: true },
      })

      return {
        ...kit,
        piecesCount: aggregate._sum.quantity ? Number(aggregate._sum.quantity) : 0,
      }
    }),
  )
}
