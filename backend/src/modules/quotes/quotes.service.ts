import type { Prisma, QuoteItem } from '../../../generated/prisma/index.js'
import { createWithUniqueCode, nextSequentialCode } from '../../lib/code-generator.js'
import { computeQuoteTotals, withQuoteItemSubtotals } from '../../lib/quote-commercials.js'
import { prisma } from '../../lib/prisma.js'
import type { CreateQuoteInput, ListQuotesQuery, UpdateQuoteInput } from '../../schemas/quote.schema.js'

function withQuoteCommercials<T extends { items: QuoteItem[] }>(quote: T) {
  return {
    ...quote,
    items: quote.items.map((item) => withQuoteItemSubtotals(item)),
    totals: computeQuoteTotals(quote.items),
  }
}

export class QuoteValidationError extends Error {}

const quoteInclude = {
  customer: true,
  items: {
    include: {
      product: { include: { family: true, category: true, route: true } },
    },
    orderBy: { sequence: 'asc' },
  },
  order: true,
} satisfies Prisma.QuoteInclude

export async function listQuotes(query: ListQuotesQuery) {
  const where: Prisma.QuoteWhereInput = {
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
    prisma.quote.findMany({
      where,
      include: { customer: true, items: true, order: true },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.quote.count({ where }),
  ])

  return {
    items: items.map(withQuoteCommercials),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
}

export async function getQuoteById(id: number) {
  const quote = await prisma.quote.findUnique({ where: { id }, include: quoteInclude })
  return quote ? withQuoteCommercials(quote) : null
}

export async function createQuote(data: CreateQuoteInput) {
  const customer = await prisma.customer.findUnique({ where: { id: data.customerId } })
  if (!customer) throw new QuoteValidationError('El cliente seleccionado no existe')

  for (const item of data.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } })
    if (!product) throw new QuoteValidationError(`El producto con id ${item.productId} no existe`)
  }

  return prisma.$transaction(async (tx) => {
    const quote = await createWithUniqueCode({
      uniqueField: 'code',
      generateCode: (attempt) => nextSequentialCode('quote', tx, attempt),
      conflictMessage: (code) => `El código de cotización "${code}" ya existe`,
      create: (code) =>
        tx.quote.create({
          data: {
            code,
            customerId: data.customerId,
            quoteDate: data.quoteDate,
            notes: data.notes,
            items: {
              create: data.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitCostWithTax: item.unitCostWithTax,
                unitCostWithoutTax: item.unitCostWithoutTax,
                marginPercentage: item.marginPercentage,
                unitPriceWithTax: item.unitPriceWithTax,
                notes: item.notes,
                sequence: item.sequence,
              })),
            },
          },
          include: quoteInclude,
        }),
    })
    return withQuoteCommercials(quote)
  })
}

export async function updateQuote(id: number, data: UpdateQuoteInput) {
  const quote = await prisma.quote.findUnique({ where: { id } })
  if (!quote) return null

  if (quote.status === 'APPROVED' || quote.status === 'REJECTED') {
    throw new QuoteValidationError(
      `No se puede editar una cotización en estado ${quote.status}`,
    )
  }

  if (data.items) {
    for (const item of data.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) throw new QuoteValidationError(`El producto con id ${item.productId} no existe`)
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id },
      data: {
        customerId: data.customerId,
        quoteDate: data.quoteDate,
        notes: data.notes,
      },
    })

    if (data.items) {
      await tx.quoteItem.deleteMany({ where: { quoteId: id } })
      await tx.quoteItem.createMany({
        data: data.items.map((item) => ({
          quoteId: id,
          productId: item.productId,
          quantity: item.quantity,
          unitCostWithTax: item.unitCostWithTax,
          unitCostWithoutTax: item.unitCostWithoutTax,
          marginPercentage: item.marginPercentage,
          unitPriceWithTax: item.unitPriceWithTax,
          notes: item.notes,
          sequence: item.sequence,
        })),
      })
    }

    const updated = await tx.quote.findUniqueOrThrow({ where: { id }, include: quoteInclude })
    return withQuoteCommercials(updated)
  })
}

/**
 * Regla 1: cotización aprobada → crea Pedido de forma transaccional.
 * Idempotente: si la cotización ya está aprobada y tiene un pedido, se
 * retorna el existente en lugar de crear uno duplicado (la FK
 * `order.quoteId` es única, así que un segundo intento de creación fallaría
 * de todas formas; esto evita ese error y da una respuesta clara).
 *
 * INVARIANTE: una colisión de código jamás puede mutar un Pedido
 * existente. El código de Pedido siempre se crea con `create` (nunca
 * `upsert`) a través de `createWithUniqueCode`: como este flujo siempre
 * genera el código automáticamente (nunca lo recibe del usuario), un
 * choque de unicidad se resuelve regenerando y reintentando — nunca
 * actualizando `quoteId`, cliente, estado ni ningún otro campo de un
 * Pedido ya existente. Si los reintentos se agotan, se lanza
 * `CodeConflictError`, que el controller traduce a HTTP 409 sin haber
 * tocado ningún registro.
 */
export async function approveQuote(id: number) {
  const quote = await prisma.quote.findUnique({ where: { id }, include: { order: true } })
  if (!quote) return null

  if (quote.status === 'REJECTED') {
    throw new QuoteValidationError('No se puede aprobar una cotización rechazada')
  }

  if (quote.status === 'APPROVED') {
    if (quote.order) {
      return { quote: await getQuoteById(id), order: quote.order, alreadyApproved: true }
    }
    // Estado inconsistente (no debería ocurrir): aprobada sin pedido. Se
    // genera el pedido faltante en vez de fallar silenciosamente.
  }

  return prisma.$transaction(async (tx) => {
    const fullQuote = await tx.quote.findUniqueOrThrow({
      where: { id },
      include: { items: true },
    })

    const updatedQuote = await tx.quote.update({
      where: { id },
      data: { status: 'APPROVED' },
    })

    const order = await createWithUniqueCode({
      uniqueField: 'code',
      generateCode: (attempt) => nextSequentialCode('order', tx, attempt),
      conflictMessage: (code) => `El código de pedido "${code}" ya existe`,
      create: (code) =>
        tx.order.create({
          data: {
            code,
            customerId: fullQuote.customerId,
            quoteId: fullQuote.id,
            status: 'PENDING_REVIEW',
            items: {
              create: fullQuote.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                notes: item.notes,
                sequence: item.sequence,
              })),
            },
          },
          include: { items: true },
        }),
    })

    return {
      quote: { ...updatedQuote, order },
      order,
      alreadyApproved: false,
    }
  })
}
