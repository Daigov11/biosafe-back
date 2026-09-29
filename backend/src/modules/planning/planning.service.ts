import { Prisma } from '../../../generated/prisma/index.js'
import { businessDateRangeFilter } from '../../lib/business-date-range.js'
import { prisma } from '../../lib/prisma.js'
import { computeMaterialYieldEstimate } from '../product-material-yields/product-material-yields.service.js'
import { getProductionOrderStatusSummary } from '../production-orders/status-summary.service.js'
import { computeCompliance, dayKey } from './plant-compliance.js'
import type {
  CreatePlantCapacityInput,
  GenerateSchedulesInput,
  PlantViewQuery,
  ReorderSchedulesInput,
  UpdatePlantCapacityInput,
  UpdatePlantScheduleInput,
} from '../../schemas/planning.schema.js'

export class PlanningValidationError extends Error {}

// ---------------------------------------------------------------------------
// Capacidades de planta
// ---------------------------------------------------------------------------

export function listCapacities() {
  return prisma.plantCapacity.findMany({
    include: { product: true, productFamily: true },
    orderBy: { code: 'asc' },
  })
}

export async function createCapacity(input: CreatePlantCapacityInput) {
  try {
    return await prisma.plantCapacity.create({ data: input })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PlanningValidationError('Ya existe una capacidad con ese código')
    }
    throw error
  }
}

export async function updateCapacity(id: number, input: UpdatePlantCapacityInput) {
  const existing = await prisma.plantCapacity.findUnique({ where: { id } })
  if (!existing) return null
  try {
    return await prisma.plantCapacity.update({ where: { id }, data: input })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PlanningValidationError('Ya existe una capacidad con ese código')
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Lotes disponibles para planeamiento (búsqueda por código/cliente/producto)
// ---------------------------------------------------------------------------

export async function searchAvailableLots(search?: string) {
  return prisma.lot.findMany({
    where: {
      AND: [
        { status: { in: ['PLANNED', 'IN_PRODUCTION'] } },
        search
          ? {
              OR: [
                { lotCode: { contains: search } },
                { order: { customer: { name: { contains: search } } } },
                { product: { name: { contains: search } } },
                { product: { code: { contains: search } } },
              ],
            }
          : {},
      ],
    },
    include: {
      order: { include: { customer: true } },
      product: true,
      plantSchedule: true,
    },
    orderBy: { id: 'asc' },
  })
}

// ---------------------------------------------------------------------------
// Programación
// ---------------------------------------------------------------------------

const scheduleInclude = {
  lot: {
    include: {
      order: { include: { customer: true } },
      product: {
        include: {
          family: true,
          route: { include: { steps: { where: { active: true }, orderBy: { sequence: 'asc' } } } },
        },
      },
      productionOrder: { select: { id: true } },
    },
  },
} satisfies Prisma.PlantScheduleInclude

export function listSchedules() {
  return prisma.plantSchedule.findMany({
    include: scheduleInclude,
    orderBy: { priority: 'asc' },
  })
}

/**
 * Crea programaciones para los lotes seleccionados que aún no tienen una.
 * Idempotente: los lotes ya programados se omiten y se listan aparte.
 */
export async function generateSchedules(input: GenerateSchedulesInput) {
  const lots = await prisma.lot.findMany({
    where: { id: { in: input.lotIds } },
    include: { plantSchedule: true },
  })

  const pending = lots.filter((lot) => !lot.plantSchedule)
  const alreadyScheduled = lots.filter((lot) => lot.plantSchedule).map((lot) => lot.id)

  if (pending.length === 0) {
    return { createdIds: [], alreadyScheduledLotIds: alreadyScheduled }
  }

  const maxPriority = await prisma.plantSchedule.aggregate({ _max: { priority: true } })
  let nextPriority = (maxPriority._max.priority ?? 0) + 1

  const createdIds = await prisma.$transaction(async (tx) => {
    const ids: number[] = []
    for (const lot of pending) {
      const schedule = await tx.plantSchedule.create({
        data: { lotId: lot.id, priority: nextPriority },
      })
      nextPriority += 1
      ids.push(schedule.id)
    }
    return ids
  })

  return { createdIds, alreadyScheduledLotIds: alreadyScheduled }
}

export async function updateSchedule(id: number, input: UpdatePlantScheduleInput) {
  const existing = await prisma.plantSchedule.findUnique({ where: { id } })
  if (!existing) return null
  return prisma.plantSchedule.update({
    where: { id },
    data: input,
    include: scheduleInclude,
  })
}

export async function reorderSchedules(input: ReorderSchedulesInput) {
  await prisma.$transaction(
    input.order.map(({ id, priority }) =>
      prisma.plantSchedule.update({ where: { id }, data: { priority } }),
    ),
  )
  return listSchedules()
}

// ---------------------------------------------------------------------------
// Vista consolidada de planta: programación + capacidad + días de giro
// ---------------------------------------------------------------------------

function round(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Cumplimiento Programado vs. Real POR FECHA PROGRAMADA (mejora
 * obligatoria): a diferencia de `realQuantity`/`difference`/
 * `compliancePct` (acumulado histórico de toda la OP, ver arriba), estos
 * campos comparan lo programado para el día efectivo del lote contra el
 * PT registrado ESE MISMO DÍA (America/Lima) — nunca el acumulado de
 * toda la vida de la OP. Por eso dependen de tener una fecha programada:
 * sin fecha no hay "ese día" contra el cual comparar. Ver
 * `plant-compliance.ts` para el cálculo puro (`computeCompliance`,
 * `dayKey`) y sus pruebas unitarias.
 */
export interface PlantComplianceByDate {
  scheduledDate: Date | null
  programado: number
  real: number | null
  diferencia: number | null
  pctPR: number | null
}

export async function getPlantView(filters: PlantViewQuery = {}) {
  const [schedules, capacities] = await Promise.all([listSchedules(), listCapacities()])

  const activeCapacities = capacities.filter((capacity) => capacity.active)

  // Fecha programada efectiva: plannedDate y, en su defecto, startDate —
  // nunca una fecha inventada. `null` cuando el lote no tiene ninguna de
  // las dos, caso que la vista/exportación deben mostrar explícitamente
  // como "Sin fecha programada", sin calcular cumplimiento.
  const scheduledDateOf = (schedule: (typeof schedules)[number]) => schedule.plannedDate ?? schedule.startDate

  const dateFromKey = filters.dateFrom ? dayKey(filters.dateFrom) : null
  const dateToKey = filters.dateTo ? dayKey(filters.dateTo) : null

  const visibleSchedules =
    dateFromKey || dateToKey
      ? schedules.filter((schedule) => {
          const scheduledDate = scheduledDateOf(schedule)
          if (!scheduledDate) return false
          const key = dayKey(scheduledDate)
          if (dateFromKey && key < dateFromKey) return false
          if (dateToKey && key > dateToKey) return false
          return true
        })
      : schedules

  // PT del día programado, en lote (una sola consulta) para evitar N+1:
  // mismo criterio de "último paso activo de la ruta" que
  // status-summary.service (Dashboard, Situación de Pedido, Centro de
  // Control), aplicado sobre los registros crudos de ProductionProgress
  // para poder acotarlos por día en vez de sumar el histórico completo.
  const ptStepIdByProductionOrderId = new Map<number, number>()
  for (const schedule of visibleSchedules) {
    const productionOrderId = schedule.lot.productionOrder?.id
    if (!productionOrderId) continue
    const steps = schedule.lot.product.route?.steps ?? []
    const lastStep = steps.length > 0 ? steps[steps.length - 1] : null
    if (lastStep) ptStepIdByProductionOrderId.set(productionOrderId, lastStep.id)
  }

  const productionOrderIds = Array.from(ptStepIdByProductionOrderId.keys())
  const progressRows =
    productionOrderIds.length > 0
      ? await prisma.productionProgress.findMany({
          where: { productionOrderId: { in: productionOrderIds } },
          select: { productionOrderId: true, routeStepId: true, date: true, quantity: true },
        })
      : []

  const ptProgressByProductionOrderId = new Map<number, { date: Date; quantity: number }[]>()
  for (const row of progressRows) {
    if (ptStepIdByProductionOrderId.get(row.productionOrderId) !== row.routeStepId) continue
    const list = ptProgressByProductionOrderId.get(row.productionOrderId) ?? []
    list.push({ date: row.date, quantity: Number(row.quantity) })
    ptProgressByProductionOrderId.set(row.productionOrderId, list)
  }

  function realForScheduledDate(productionOrderId: number | undefined, scheduledDate: Date | null): number | null {
    if (!productionOrderId || !scheduledDate) return null
    const dayRange = businessDateRangeFilter(scheduledDate, scheduledDate)
    const rows = ptProgressByProductionOrderId.get(productionOrderId) ?? []
    const sum = rows
      .filter((row) => {
        if (dayRange.gte && row.date.getTime() < dayRange.gte.getTime()) return false
        if (dayRange.lt && row.date.getTime() >= dayRange.lt.getTime()) return false
        return true
      })
      .reduce((acc, row) => acc + row.quantity, 0)
    return round(sum)
  }

  return Promise.all(
    visibleSchedules.map(async (schedule) => {
      const required = Number(schedule.lot.quantity)
      const matchedCapacity =
        activeCapacities.find((capacity) => capacity.productId === schedule.lot.productId) ??
        activeCapacities.find(
          (capacity) => capacity.productFamilyId === schedule.lot.product.familyId,
        ) ??
        null

      const dailyCapacity = matchedCapacity ? Number(matchedCapacity.dailyCapacity) : null
      const daysToTurn = dailyCapacity && dailyCapacity > 0 ? Math.ceil(required / dailyCapacity) : null

      // Línea: la del primer paso de la ruta que tiene una línea física
      // configurada (se saltan los pasos administrativos como MP o control
      // de calidad de MP, que no ocurren en planta). Si ningún paso tiene
      // línea configurada, queda null — nunca se inventa.
      const firstProductionStep = schedule.lot.product.route?.steps.find((step) => step.productionLine) ?? null
      const line = firstProductionStep?.productionLine ?? null

      // Producción real acumulada (histórico completo de la OP) — se
      // mantiene para no romper ninguna pantalla existente que ya la use.
      const statusSummary = schedule.lot.productionOrder
        ? await getProductionOrderStatusSummary(schedule.lot.productionOrder.id)
        : null
      const realQuantity = statusSummary?.finishedProduct?.quantity ?? null
      const difference = realQuantity !== null ? round(realQuantity - required) : null
      const compliancePct =
        realQuantity !== null && required > 0 ? round((realQuantity / required) * 100) : null

      // Rendimiento de material (Iteración 12): bloque informativo de
      // planeamiento (rollos estimados) — no afecta `required`/capacidad
      // diaria/días de giro. `null` cuando el producto no tiene
      // rendimiento configurado.
      const materialYieldEstimate = await computeMaterialYieldEstimate(
        schedule.lot.productId,
        required,
      )

      const scheduledDate = scheduledDateOf(schedule)
      const programado = round(required)
      const real = realForScheduledDate(schedule.lot.productionOrder?.id, scheduledDate)
      const { diferencia, pctPR } = computeCompliance(programado, real)

      return {
        id: schedule.id,
        priority: schedule.priority,
        plannedDate: schedule.plannedDate,
        startDate: schedule.startDate,
        offeredEndDate: schedule.offeredEndDate,
        comments: schedule.comments,
        schedulingNotes: schedule.schedulingNotes,
        lot: {
          id: schedule.lot.id,
          lotCode: schedule.lot.lotCode,
          quantity: schedule.lot.quantity,
          status: schedule.lot.status,
          customer: schedule.lot.order.customer,
          product: schedule.lot.product,
        },
        required: round(required),
        line,
        realQuantity,
        difference,
        compliancePct,
        materialYieldEstimate,
        capacity: matchedCapacity
          ? { id: matchedCapacity.id, code: matchedCapacity.code, name: matchedCapacity.name, dailyCapacity: round(dailyCapacity ?? 0), unit: matchedCapacity.unit }
          : null,
        daysToTurn,
        // Cumplimiento por fecha programada (mejora obligatoria) — ver
        // comentario de `PlantComplianceByDate` arriba.
        scheduledDate,
        programado,
        real,
        diferencia,
        pctPR,
      }
    }),
  )
}

/**
 * Agrupa filas ya calculadas por `getPlantView` según su FECHA
 * PROGRAMADA (las sin fecha van en su propio grupo `null`, sin total de
 * cumplimiento) y calcula el total diario — reutilizado tanto por la
 * exportación Excel como, si se necesita, por cualquier vista agrupada.
 * Nunca vuelve a calcular programado/real: solo suma lo que ya viene de
 * `getPlantView`.
 */
export function groupPlantViewByDate<
  T extends { scheduledDate: Date | null; programado: number; real: number | null },
>(rows: T[]): { scheduledDate: Date | null; rows: T[]; totals: PlantComplianceByDate }[] {
  const groups = new Map<string, { scheduledDate: Date | null; rows: T[] }>()
  for (const row of rows) {
    const key = row.scheduledDate ? row.scheduledDate.toISOString().slice(0, 10) : 'sin-fecha'
    const group = groups.get(key) ?? { scheduledDate: row.scheduledDate, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))
    .map(([, group]) => {
      const programado = round(group.rows.reduce((sum, row) => sum + row.programado, 0))
      const hasReal = group.rows.some((row) => row.real !== null)
      const real = hasReal ? round(group.rows.reduce((sum, row) => sum + (row.real ?? 0), 0)) : null
      const { diferencia, pctPR } = group.scheduledDate ? computeCompliance(programado, real) : { diferencia: null, pctPR: null }
      return {
        scheduledDate: group.scheduledDate,
        rows: group.rows,
        totals: { scheduledDate: group.scheduledDate, programado, real, diferencia, pctPR },
      }
    })
}
