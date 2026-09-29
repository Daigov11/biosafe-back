import { Prisma } from '../../../generated/prisma/index.js'
import { prisma } from '../../lib/prisma.js'
import { businessDateRangeFilter } from '../../lib/business-date-range.js'
import { computeValidity } from '../sanitary-registrations/sanitary-registrations.service.js'
import { getProductionOrderStatusSummary } from '../production-orders/status-summary.service.js'
import { compliancePct, dayKey, isoWeekKey, monthKey, yearKey } from './period.js'

function round(value: number) {
  return Math.round(value * 100) / 100
}

export interface PeriodBucket {
  periodKey: string
  programado: number
  real: number
  cumplimientoPct: number | null
}

export interface ProcessSummaryRow {
  proceso: string
  linea: string | null
  unidad: string
  programado: number
  real: number
  cumplimientoPct: number | null
}

export interface DashboardFilters {
  dateFrom?: Date
  dateTo?: Date
  customerId?: number
  familyId?: number
  routeId?: number
  status?: string
}

const lotDashboardInclude = {
  order: { include: { customer: true } },
  product: {
    include: {
      family: true,
      route: { include: { steps: { where: { active: true }, orderBy: { sequence: 'asc' } } } },
    },
  },
  productionOrder: { select: { id: true, status: true } },
  plantSchedule: true,
  dispatches: true,
} satisfies Prisma.LotInclude

type LotForDashboard = Prisma.LotGetPayload<{ include: typeof lotDashboardInclude }>

/**
 * Consolida indicadores y series para el Dashboard a partir de lotes reales
 * (con sus pedidos, OP, avances y despachos) — nunca de cifras simuladas.
 * El alcance de familia/ruta/cliente/fecha/estado se aplica siempre a
 * nivel de lote+pedido, igual criterio que Situación de Pedido.
 */
export async function buildDashboard(filters: DashboardFilters) {
  const dateRange = businessDateRangeFilter(filters.dateFrom, filters.dateTo)

  const lots = await prisma.lot.findMany({
    where: {
      AND: [
        filters.dateFrom || filters.dateTo ? { order: { orderDate: dateRange } } : {},
        filters.customerId ? { order: { customerId: filters.customerId } } : {},
        filters.status ? { order: { status: filters.status as Prisma.EnumOrderStatusFilter['equals'] } } : {},
        filters.familyId ? { product: { familyId: filters.familyId } } : {},
        filters.routeId ? { product: { routeId: filters.routeId } } : {},
      ],
    },
    include: lotDashboardInclude,
    orderBy: { id: 'asc' },
  })

  // Resumen de estado por OP, calculado una sola vez por lote y reutilizado
  // en KPIs y gráficos (PT, avance por paso, despachado, saldo).
  const summaries = new Map<number, Awaited<ReturnType<typeof getProductionOrderStatusSummary>>>()
  for (const lot of lots) {
    if (lot.productionOrder && !summaries.has(lot.productionOrder.id)) {
      summaries.set(lot.productionOrder.id, await getProductionOrderStatusSummary(lot.productionOrder.id))
    }
  }

  function summaryFor(lot: LotForDashboard) {
    return lot.productionOrder ? (summaries.get(lot.productionOrder.id) ?? null) : null
  }

  // --- KPIs -----------------------------------------------------------
  const orderIds = new Set(lots.map((lot) => lot.order.id))
  const activeOrders = await prisma.order.count({
    where: { id: { in: Array.from(orderIds) }, status: { not: 'CANCELLED' } },
  })

  const lotesPlanificados = lots.filter((lot) => lot.status === 'PLANNED').length
  const lotesEnProduccion = lots.filter((lot) => lot.status === 'IN_PRODUCTION').length

  const produccionProgramada = round(
    lots.filter((lot) => lot.plantSchedule).reduce((sum, lot) => sum + Number(lot.quantity), 0),
  )

  let productoTerminado = 0
  let despachado = 0
  let requeridoConAvance = 0
  for (const lot of lots) {
    const summary = summaryFor(lot)
    if (summary?.finishedProduct) {
      productoTerminado += summary.finishedProduct.quantity
      requeridoConAvance += summary.requiredQuantity
    }
    despachado += lot.dispatches.reduce((sum, dispatch) => sum + Number(dispatch.quantity), 0)
  }
  productoTerminado = round(productoTerminado)
  despachado = round(despachado)

  const totalRequerido = round(lots.reduce((sum, lot) => sum + Number(lot.quantity), 0))
  const saldo = round(totalRequerido - despachado)
  const cumplimientoPct = requeridoConAvance > 0 ? round((productoTerminado / requeridoConAvance) * 100) : null

  const activeSanitaryRegistrations = await prisma.sanitaryRegistration.findMany({
    where: { active: true },
    select: { expirationDate: true },
  })
  const registrosSanitariosPorVencer = activeSanitaryRegistrations.filter(
    (registration) => computeValidity(registration.expirationDate) === 'POR_VENCER',
  ).length

  // --- Gráficos ---------------------------------------------------------

  // Programado vs. real, por familia de producto.
  const byFamily = new Map<string, { programado: number; real: number }>()
  for (const lot of lots) {
    const label = lot.product.family?.name ?? 'Sin familia'
    const entry = byFamily.get(label) ?? { programado: 0, real: 0 }
    entry.programado += Number(lot.quantity)
    const summary = summaryFor(lot)
    if (summary?.finishedProduct) entry.real += summary.finishedProduct.quantity
    byFamily.set(label, entry)
  }
  const programadoVsReal = Array.from(byFamily.entries()).map(([label, value]) => ({
    label,
    programado: round(value.programado),
    real: round(value.real),
  }))

  // Avance por proceso (paso de ruta), con línea asociada. También acumula
  // `programado` (requerido de las OP cuya ruta activa incluye ese paso) y
  // la menor secuencia vista, para ordenar processSummary como un flujo de
  // planta real. La secuencia por sí sola no basta para ordenar entre
  // rutas de distinto largo: en F02 (sin esterilización) "Producto
  // terminado" es el paso 9, pero en F01 es el paso 11 — un simple
  // Math.min() lo colocaría antes que "Control de calidad final" (paso 10,
  // solo en F01). Por eso se guarda además `isFinishedProductStep`
  // (el mismo flag que status-summary.service ya usa para identificar el
  // último paso activo de CADA ruta) y se lo fuerza siempre al final,
  // sin importar su número de secuencia relativo.
  const byStep = new Map<
    string,
    {
      line: string | null
      real: number
      programado: number
      sequence: number
      isFinishedProductStep: boolean
    }
  >()
  for (const summary of summaries.values()) {
    if (!summary) continue
    for (const step of summary.steps) {
      const key = step.name
      const entry = byStep.get(key) ?? {
        line: step.productionLine,
        real: 0,
        programado: 0,
        sequence: step.sequence,
        isFinishedProductStep: false,
      }
      entry.real += step.accumulatedQuantity
      entry.programado += summary.requiredQuantity
      entry.sequence = Math.min(entry.sequence, step.sequence)
      entry.isFinishedProductStep = entry.isFinishedProductStep || step.isFinishedProductStep
      byStep.set(key, entry)
    }
  }
  const avancePorProceso = Array.from(byStep.entries())
    .map(([label, value]) => ({ label, line: value.line, value: round(value.real) }))
    .sort((a, b) => b.value - a.value)

  // Resumen por proceso (Iteración 15): solo los pasos de ruta con línea de
  // producción física configurada (Corte, Costura, Empaque, Esterilización,
  // Control de calidad final, Producto terminado, según exista en cada
  // ruta) — los pasos administrativos/logísticos (MP, Almacén, Requerimiento,
  // Abastecimiento) nunca tienen `productionLine` y quedan fuera de esta
  // tabla, igual criterio que "Línea" en Programación de Planta.
  const processSummary: ProcessSummaryRow[] = Array.from(byStep.entries())
    .filter(([, value]) => value.line !== null)
    .sort((a, b) => {
      if (a[1].isFinishedProductStep !== b[1].isFinishedProductStep) {
        return a[1].isFinishedProductStep ? 1 : -1
      }
      return a[1].sequence - b[1].sequence
    })
    .map(([label, value]) => ({
      proceso: label,
      linea: value.line,
      unidad: 'und',
      programado: round(value.programado),
      real: round(value.real),
      cumplimientoPct: compliancePct(value.programado, value.real),
    }))

  // Producción por periodo (semana ISO), a partir de avance registrado en
  // TODOS los pasos (gráfico existente, sin cambios de comportamiento).
  // Se reutiliza la misma consulta para derivar el "Real" de
  // periodSummary (Iteración 15), que solo cuenta el paso PT de cada OP —
  // se amplía el `select` para poder filtrar por routeStepId sin una
  // segunda consulta.
  const progressRows = await prisma.productionProgress.findMany({
    where: { productionOrderId: { in: Array.from(summaries.keys()) } },
    select: { productionOrderId: true, routeStepId: true, date: true, quantity: true },
  })
  const byPeriod = new Map<string, number>()
  for (const row of progressRows) {
    const label = isoWeekKey(row.date)
    byPeriod.set(label, (byPeriod.get(label) ?? 0) + Number(row.quantity))
  }
  const produccionPorPeriodo = Array.from(byPeriod.entries())
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([label, value]) => ({ label, value: round(value) }))

  // --- Periodos de cumplimiento (Iteración 15) --------------------------
  // Programado: cantidad del lote, por cada lote con PlantSchedule (ver
  // elección de fecha más abajo). Real: avance registrado específicamente
  // en el paso PT (último paso activo de la ruta del producto) de cada
  // OP — el mismo paso que ya usa `finishedProduct` en
  // status-summary.service.
  const ptStepIdByProductionOrderId = new Map<number, number>()
  for (const lot of lots) {
    if (!lot.productionOrder) continue
    const steps = lot.product.route?.steps ?? []
    const lastStep = steps.length > 0 ? steps[steps.length - 1] : null
    if (lastStep) ptStepIdByProductionOrderId.set(lot.productionOrder.id, lastStep.id)
  }

  // Fecha del "Programado": se prefiere la fecha planificada del
  // planeamiento (`plannedDate`, la misma que muestra "Fecha planificada"
  // en Programación de Planta); si el planeamiento aún no la definió, se
  // usa `startDate` y luego `offeredEndDate` del mismo PlantSchedule: y
  // solo si el lote no tiene NINGUNA fecha de planeamiento (caso real de
  // este dataset demo, donde ningún PlantSchedule tiene fechas cargadas
  // todavía), se usa `order.orderDate` — un dato real ya persistido, nunca
  // una fecha inventada — para que un lote programado siga apareciendo en
  // algún periodo en vez de desaparecer por completo del panel.
  const programadoEntries = lots
    .filter((lot) => lot.plantSchedule)
    .map((lot) => ({
      date:
        lot.plantSchedule!.plannedDate ??
        lot.plantSchedule!.startDate ??
        lot.plantSchedule!.offeredEndDate ??
        lot.order.orderDate,
      quantity: Number(lot.quantity),
    }))

  const realEntries = progressRows
    .filter((row) => ptStepIdByProductionOrderId.get(row.productionOrderId) === row.routeStepId)
    .map((row) => ({ date: row.date, quantity: Number(row.quantity) }))

  function buildPeriodBuckets(keyFn: (date: Date) => string): PeriodBucket[] {
    const buckets = new Map<string, { programado: number; real: number }>()
    for (const entry of programadoEntries) {
      const key = keyFn(entry.date)
      const bucket = buckets.get(key) ?? { programado: 0, real: 0 }
      bucket.programado += entry.quantity
      buckets.set(key, bucket)
    }
    for (const entry of realEntries) {
      const key = keyFn(entry.date)
      const bucket = buckets.get(key) ?? { programado: 0, real: 0 }
      bucket.real += entry.quantity
      buckets.set(key, bucket)
    }
    return Array.from(buckets.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0))
      .map(([periodKey, value]) => ({
        periodKey,
        programado: round(value.programado),
        real: round(value.real),
        cumplimientoPct: compliancePct(value.programado, value.real),
      }))
  }

  const periodSummary = {
    annual: buildPeriodBuckets(yearKey),
    monthly: buildPeriodBuckets(monthKey),
    weekly: buildPeriodBuckets(isoWeekKey),
    daily: buildPeriodBuckets(dayKey),
  }

  // Cumplimiento por ruta.
  const byRoute = new Map<string, { required: number; real: number }>()
  for (const lot of lots) {
    const label = lot.product.route ? `${lot.product.route.code} · ${lot.product.route.name}` : 'Sin ruta'
    const entry = byRoute.get(label) ?? { required: 0, real: 0 }
    const summary = summaryFor(lot)
    if (summary?.finishedProduct) {
      entry.required += summary.requiredQuantity
      entry.real += summary.finishedProduct.quantity
    }
    byRoute.set(label, entry)
  }
  const cumplimientoPorRuta = Array.from(byRoute.entries())
    .filter(([, value]) => value.required > 0)
    .map(([label, value]) => ({ label, pct: round((value.real / value.required) * 100) }))

  // Pedidos por estado (sobre el conjunto de pedidos filtrado).
  const orders = await prisma.order.findMany({
    where: { id: { in: Array.from(orderIds) } },
    select: { status: true },
  })
  const byOrderStatus = new Map<string, number>()
  for (const order of orders) {
    byOrderStatus.set(order.status, (byOrderStatus.get(order.status) ?? 0) + 1)
  }
  const pedidosPorEstado = Array.from(byOrderStatus.entries()).map(([label, value]) => ({ label, value }))

  return {
    // Momento real de la consulta — nunca un valor fijo. El front lo
    // muestra como "Actualizado: DD/MM/YYYY HH:MM".
    updatedAt: new Date().toISOString(),
    kpis: {
      pedidosActivos: activeOrders,
      lotesPlanificados,
      lotesEnProduccion,
      produccionProgramada,
      productoTerminado,
      despachado,
      saldo,
      cumplimientoPct,
      registrosSanitariosPorVencer,
    },
    charts: {
      programadoVsReal,
      avancePorProceso,
      produccionPorPeriodo,
      cumplimientoPorRuta,
      pedidosPorEstado,
    },
    periodSummary,
    processSummary,
  }
}
