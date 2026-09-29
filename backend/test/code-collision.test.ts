import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { CodeConflictError, createWithUniqueCode, nextSequentialCode } from '../src/lib/code-generator.js'
import * as quotesService from '../src/modules/quotes/quotes.service.js'
import * as ordersService from '../src/modules/orders/orders.service.js'
import * as ordersController from '../src/modules/orders/orders.controller.js'

/**
 * Pruebas de la protección contra colisiones de código (Cotización →
 * Pedido → Lote → Orden de Producción). Verifican el invariante pedido:
 * "una colisión de código jamás puede mutar una entidad existente".
 *
 * Corren contra la base de datos de desarrollo real (no hay un motor de
 * pruebas separado en este proyecto). Todos los datos que crean llevan el
 * prefijo TEST_TAG y se eliminan en `afterAll` — no tocan ni modifican
 * ningún dato demo del seed.
 */

const TEST_TAG = `TESTCOL-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

const customerIds: number[] = []
const productIds: number[] = []
const quoteIds: number[] = []
const orderIds: number[] = []

function mockResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(body: unknown) {
      res.body = body
      return res
    },
  }
  return res
}

async function createTestCustomer(suffix: string) {
  const customer = await prisma.customer.create({ data: { name: `${TEST_TAG}-cust-${suffix}` } })
  customerIds.push(customer.id)
  return customer
}

async function createTestProduct(suffix: string) {
  const product = await prisma.product.create({
    data: { code: `${TEST_TAG}-PROD-${suffix}`, name: `Producto de prueba ${suffix}` },
  })
  productIds.push(product.id)
  return product
}

/** Cotización → Pedido → revisado → aprobado, lista para generar Lote/OP. */
async function createApprovedOrder(suffix: string, quantity = 10) {
  const customer = await createTestCustomer(suffix)
  const product = await createTestProduct(suffix)

  const quote = await quotesService.createQuote({
    customerId: customer.id,
    items: [{ productId: product.id, quantity, sequence: 1 }],
  })
  quoteIds.push(quote.id)

  const approveResult = await quotesService.approveQuote(quote.id)
  if (!approveResult) throw new Error('approveQuote devolvió null inesperadamente')
  orderIds.push(approveResult.order.id)

  await ordersService.reviewOrder(approveResult.order.id)
  const approvedOrder = await ordersService.approveOrder(approveResult.order.id)
  if (!approvedOrder) throw new Error('approveOrder devolvió null inesperadamente')

  return { customer, product, quote, order: approvedOrder }
}

/** Cotización + Pedido creados directamente por prisma, simulando una fila
 * "externa" ya existente con un código específico — igual que el
 * incidente real (PED-0009 creado a mano, luego colisionado por el
 * seed). No pasa por `approveQuote`, a propósito: el objetivo es ocupar
 * un código exacto para forzar la colisión, no probar el flujo completo. */
async function createDecoyOrderWithCode(suffix: string, code: string) {
  const customer = await createTestCustomer(`decoy-${suffix}`)
  const quote = await prisma.quote.create({
    data: { code: `${TEST_TAG}-DECOY-QUOTE-${suffix}`, customerId: customer.id, status: 'DRAFT' },
  })
  quoteIds.push(quote.id)
  const order = await prisma.order.create({
    data: { code, customerId: customer.id, quoteId: quote.id, status: 'PENDING_REVIEW' },
  })
  orderIds.push(order.id)
  return order
}

async function safeCleanupStep(label: string, run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    // Un paso de limpieza que falla no debe ocultar el resultado real de
    // los tests ni impedir que se intenten los demás pasos (mejor dejar
    // algún residuo aislado con prefijo TEST_TAG, fácil de identificar y
    // borrar a mano, que abortar el resto de la limpieza).
    // eslint-disable-next-line no-console
    console.warn(`[code-collision.test] limpieza "${label}" falló:`, error)
  }
}

afterAll(async () => {
  try {
    // No confía únicamente en `orderIds` explícito: algunas pruebas dejan
    // que el propio flujo (p.ej. un `approveQuote` exitoso) cree un
    // Pedido sin que el test lo empuje a mano a `orderIds`. Se
    // redescubren todos los pedidos ligados a las cotizaciones de prueba
    // por `quoteId` para no dejar filas huérfanas que rompan el borrado
    // por FK.
    const relatedOrders = await prisma.order.findMany({
      where: { OR: [{ id: { in: orderIds } }, { quoteId: { in: quoteIds } }] },
      select: { id: true },
    })
    const allOrderIds = relatedOrders.map((o) => o.id)

    await safeCleanupStep('productionOrderMaterial', () =>
      prisma.productionOrderMaterial.deleteMany({
        where: { productionOrder: { lot: { orderId: { in: allOrderIds } } } },
      }),
    )
    await safeCleanupStep('labelApproval', () =>
      prisma.labelApproval.deleteMany({ where: { lot: { orderId: { in: allOrderIds } } } }),
    )
    await safeCleanupStep('productionOrder', () =>
      prisma.productionOrder.deleteMany({ where: { lot: { orderId: { in: allOrderIds } } } }),
    )
    await safeCleanupStep('lot', () => prisma.lot.deleteMany({ where: { orderId: { in: allOrderIds } } }))
    await safeCleanupStep('orderItem', () =>
      prisma.orderItem.deleteMany({ where: { orderId: { in: allOrderIds } } }),
    )
    await safeCleanupStep('order', () => prisma.order.deleteMany({ where: { id: { in: allOrderIds } } }))
    await safeCleanupStep('quoteItem', () =>
      prisma.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } }),
    )
    await safeCleanupStep('quote', () => prisma.quote.deleteMany({ where: { id: { in: quoteIds } } }))
    await safeCleanupStep('product', () => prisma.product.deleteMany({ where: { id: { in: productIds } } }))
    await safeCleanupStep('customer', () =>
      prisma.customer.deleteMany({ where: { id: { in: customerIds } } }),
    )
  } finally {
    await prisma.$disconnect()
  }
})

describe('Protección contra colisiones de código (invariante: una colisión de código jamás muta una entidad existente)', () => {
  it('Lote: un lotCode ingresado por el usuario que ya existe se rechaza con 409, sin mutar el lote original ni crear lote/OP parciales', async () => {
    const first = await createApprovedOrder('lot-user-a')
    const firstItemId = first.order.items[0].id
    const collidingLotCode = `${TEST_TAG}-LOT-COLLISION`

    await ordersService.generateProductionOrders(first.order.id, {
      items: [{ orderItemId: firstItemId, lotCode: collidingLotCode }],
    })
    const originalLot = await prisma.lot.findUniqueOrThrow({ where: { lotCode: collidingLotCode } })

    const second = await createApprovedOrder('lot-user-b')
    const secondItemId = second.order.items[0].id

    const res = mockResponse()
    await ordersController.generateProductionOrder(
      {
        params: { id: String(second.order.id) },
        body: { items: [{ orderItemId: secondItemId, lotCode: collidingLotCode }] },
      } as never,
      res as never,
    )

    // Confirmar respuesta 409.
    expect(res.statusCode).toBe(409)
    expect((res.body as { message: string }).message).toContain(collidingLotCode)

    // Confirmar que el lote original no cambió en ningún campo.
    const originalLotAfter = await prisma.lot.findUniqueOrThrow({
      where: { lotCode: collidingLotCode },
    })
    expect(originalLotAfter).toEqual(originalLot)

    // Confirmar que no se creó lote ni OP parcial para el segundo pedido.
    const secondItemAfter = await prisma.orderItem.findUniqueOrThrow({
      where: { id: secondItemId },
      include: { lot: true },
    })
    expect(secondItemAfter.lot).toBeNull()

    const productionOrdersForSecondOrder = await prisma.productionOrder.findMany({
      where: { lot: { orderId: second.order.id } },
    })
    expect(productionOrdersForSecondOrder).toHaveLength(0)
  })

  it('Pedido: un código autogenerado que ya existe (colisión externa, como el incidente real) se resuelve reintentando — nunca reescribe el pedido preexistente', async () => {
    const nextCode = await nextSequentialCode('order')
    const decoyOrder = await createDecoyOrderWithCode('order-retry', nextCode)
    const decoySnapshot = { ...decoyOrder }

    const real = await createApprovedOrder('order-retry-real', 5)

    // El pedido real jamás debió reutilizar el código del decoy ni su fila.
    expect(real.order.code).not.toBe(nextCode)
    expect(real.order.id).not.toBe(decoyOrder.id)

    // El pedido "externo" preexistente permanece exactamente igual.
    const decoyAfter = await prisma.order.findUniqueOrThrow({ where: { id: decoyOrder.id } })
    expect(decoyAfter).toEqual(decoySnapshot)
  })

  it('createWithUniqueCode: si TODOS los intentos de generación colisionan (p.ej. una carrera concurrente), se rechaza con CodeConflictError tras exactamente el máximo de intentos, sin dejar ninguna fila creada', async () => {
    // Ocupa un nombre real y fuerza a `generateCode` a devolver siempre
    // ese mismo candidato ya ocupado — simula el peor caso (todos los
    // intentos colisionan, como en una carrera concurrente real) sin
    // depender de que el generador de códigos secuenciales sea "burlable"
    // con datos preexistentes (con el algoritmo basado en máximo, no lo
    // es: ver el test anterior).
    const takenName = await createTestCustomer('unique-always-collides')
    let createAttempts = 0

    await expect(
      createWithUniqueCode({
        uniqueField: 'name',
        generateCode: () => takenName.name,
        conflictMessage: (code) => `El nombre "${code}" ya existe`,
        create: (name) => {
          createAttempts += 1
          return prisma.customer.create({ data: { name } })
        },
      }),
    ).rejects.toThrow(CodeConflictError)

    // Se agotaron exactamente los intentos configurados — ni menos (no se
    // rinde antes de tiempo) ni más (no reintenta indefinidamente).
    expect(createAttempts).toBe(5)

    // Ninguna fila quedó creada a partir de los intentos fallidos: sigue
    // existiendo únicamente la original.
    const matches = await prisma.customer.findMany({ where: { name: takenName.name } })
    expect(matches).toHaveLength(1)
    expect(matches[0].id).toBe(takenName.id)
  })

  it('createWithUniqueCode: un código autogenerado que colisiona una vez se resuelve en el siguiente intento, sin repetir el candidato ya probado', async () => {
    const taken = await createTestCustomer('unique-retry-once')
    const fresh = `${TEST_TAG}-cust-unique-retry-once-fresh`
    const attempts: string[] = []

    const created = await createWithUniqueCode({
      uniqueField: 'name',
      generateCode: (attempt) => (attempt === 0 ? taken.name : fresh),
      conflictMessage: (code) => `El nombre "${code}" ya existe`,
      create: (name) => {
        attempts.push(name)
        return prisma.customer.create({ data: { name } })
      },
    })
    customerIds.push(created.id)

    expect(attempts).toEqual([taken.name, fresh])
    expect(created.name).toBe(fresh)
  })

  it('Nunca usa upsert por código: dos intentos de creación con el mismo código de Pedido nunca fusionan datos de dos cotizaciones distintas', async () => {
    const first = await createApprovedOrder('no-upsert-a')
    const firstOrderId = first.order.id
    const firstQuoteId = first.quote.id

    const second = await createApprovedOrder('no-upsert-b')

    // Cada pedido conserva su propia cotización de origen — nunca se
    // fusionaron ni se sobrescribió `quoteId` de uno con el del otro.
    const firstOrderAfter = await prisma.order.findUniqueOrThrow({ where: { id: firstOrderId } })
    expect(firstOrderAfter.quoteId).toBe(firstQuoteId)
    expect(firstOrderAfter.quoteId).not.toBe(second.order.quoteId)
    expect(firstOrderAfter.code).not.toBe(second.order.code)
  })
})
