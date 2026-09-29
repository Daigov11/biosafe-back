import { prisma } from '../../lib/prisma.js'

function round(value: number) {
  return Math.round(value * 100) / 100
}

export interface StepProgressSummary {
  routeStepId: number
  code: string
  name: string
  sequence: number
  productionLine: string | null
  accumulatedQuantity: number
  percentage: number
  isFinishedProductStep: boolean
  isQualityStep: boolean
  overProduced: boolean
}

export interface ProductionOrderStatusSummary {
  requiredQuantity: number
  steps: StepProgressSummary[]
  finishedProduct: { quantity: number; percentage: number; overProduced: boolean } | null
  quality: { quantity: number; percentage: number; stepName: string; overProduced: boolean } | null
  dispatched: { quantity: number; percentage: number }
  balance: { quantity: number; percentage: number }
  availableToDispatch: number
}

/**
 * Calcula el resumen operativo de una OP a partir de los registros
 * persistidos en `production_progress` y `dispatches`. Nunca lee ni escribe
 * un porcentaje o acumulado guardado: todo se deriva aquí en cada consulta.
 *
 * PT ("Producto terminado") corresponde al último paso activo de la ruta
 * del producto (por secuencia), y el control de calidad final al último
 * paso activo cuyo nombre referencia "calidad" — ambos derivados de los
 * pasos reales configurados en la ruta, nunca de un código hardcodeado
 * como "PT" o "CC-FINAL" válido solo para F01.
 */
export async function getProductionOrderStatusSummary(
  productionOrderId: number,
): Promise<ProductionOrderStatusSummary | null> {
  const productionOrder = await prisma.productionOrder.findUnique({
    where: { id: productionOrderId },
    select: {
      lotId: true,
      lot: {
        select: {
          quantity: true,
          product: {
            select: {
              route: {
                select: {
                  steps: {
                    where: { active: true },
                    orderBy: { sequence: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!productionOrder) return null

  const requiredQuantity = Number(productionOrder.lot.quantity)
  const steps = productionOrder.lot.product.route?.steps ?? []

  const progressRows = await prisma.productionProgress.groupBy({
    by: ['routeStepId'],
    where: { productionOrderId },
    _sum: { quantity: true },
  })
  const accumulatedByStep = new Map(
    progressRows.map((row) => [row.routeStepId, Number(row._sum.quantity ?? 0)]),
  )

  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null
  const qualitySteps = steps.filter((step) => /calidad/i.test(step.name))
  const qualityStep = qualitySteps.length > 0 ? qualitySteps[qualitySteps.length - 1] : null

  function percentageOf(quantity: number) {
    return requiredQuantity > 0 ? round((quantity / requiredQuantity) * 100) : 0
  }

  const stepSummaries: StepProgressSummary[] = steps.map((step) => {
    const accumulated = accumulatedByStep.get(step.id) ?? 0
    return {
      routeStepId: step.id,
      code: step.code,
      name: step.name,
      sequence: step.sequence,
      productionLine: step.productionLine,
      accumulatedQuantity: round(accumulated),
      percentage: percentageOf(accumulated),
      isFinishedProductStep: lastStep?.id === step.id,
      isQualityStep: qualityStep?.id === step.id,
      overProduced: accumulated > requiredQuantity,
    }
  })

  const finishedProductQuantity = lastStep ? (accumulatedByStep.get(lastStep.id) ?? 0) : 0
  const qualityQuantity = qualityStep ? (accumulatedByStep.get(qualityStep.id) ?? 0) : 0

  const dispatchAgg = await prisma.dispatch.aggregate({
    where: { lotId: productionOrder.lotId },
    _sum: { quantity: true },
  })
  const dispatchedQuantity = Number(dispatchAgg._sum.quantity ?? 0)
  const balanceQuantity = requiredQuantity - dispatchedQuantity

  return {
    requiredQuantity: round(requiredQuantity),
    steps: stepSummaries,
    finishedProduct: lastStep
      ? {
          quantity: round(finishedProductQuantity),
          percentage: percentageOf(finishedProductQuantity),
          overProduced: finishedProductQuantity > requiredQuantity,
        }
      : null,
    quality: qualityStep
      ? {
          quantity: round(qualityQuantity),
          percentage: percentageOf(qualityQuantity),
          stepName: qualityStep.name,
          overProduced: qualityQuantity > requiredQuantity,
        }
      : null,
    dispatched: { quantity: round(dispatchedQuantity), percentage: percentageOf(dispatchedQuantity) },
    balance: { quantity: round(balanceQuantity), percentage: percentageOf(balanceQuantity) },
    availableToDispatch: round(Math.max(0, finishedProductQuantity - dispatchedQuantity)),
  }
}
