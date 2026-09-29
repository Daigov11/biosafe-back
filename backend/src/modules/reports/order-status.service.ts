import { Prisma } from '../../../generated/prisma/index.js'
import { businessDateRangeFilter } from '../../lib/business-date-range.js'
import { computeFabricWeightKg } from '../../lib/fabric-weight.js'
import { prisma } from '../../lib/prisma.js'
import { getProductionOrderStatusSummary } from '../production-orders/status-summary.service.js'
import type { StepProgressSummary } from '../production-orders/status-summary.service.js'

function round(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Encuentra el paso de ruta que representa un proceso genérico (corte,
 * costura, empaque, esterilizado) por coincidencia de nombre — igual
 * criterio que PT/calidad en status-summary.service.ts: nunca un código
 * fijo, siempre los pasos reales de la ruta del producto.
 */
function matchStep(steps: StepProgressSummary[], pattern: RegExp) {
  const matches = steps.filter((step) => pattern.test(step.name))
  return matches.length > 0 ? matches[matches.length - 1] : null
}

/**
 * Suma los tiempos estándar registrados para un producto/pieza a través de
 * todos sus pasos de ruta. Si no hay ningún registro, retorna null — nunca
 * se inventa un valor.
 */
async function getStandardTimeTotal(productId: number) {
  const rows = await prisma.productStandardTime.findMany({ where: { productId } })
  if (rows.length === 0) return null
  return round(rows.reduce((sum, row) => sum + Number(row.standardTimeMinutes), 0))
}

/**
 * Encuentra el ítem de BOM de tela (materia prima) de un producto/pieza —
 * mismo criterio de nombre/tipo que el resto del reporte. Se retorna el
 * ítem completo (no solo la materia prima) para poder calcular metros
 * requeridos a partir de su cantidad por unidad + merma.
 */
async function findFabricBomItem(productId: number) {
  const header = await prisma.bomHeader.findUnique({
    where: { productId },
    include: { items: { include: { rawMaterial: true }, orderBy: { sequence: 'asc' } } },
  })
  if (!header) return null
  return (
    header.items.find(
      (item) =>
        item.componentType === 'RAW_MATERIAL' &&
        item.rawMaterial &&
        /tela/i.test(`${item.rawMaterial.name} ${item.rawMaterial.type ?? ''}`),
    ) ?? null
  )
}

const METER_UNIT_CODES = new Set(['m', 'mt', 'metro', 'metros'])

/**
 * Metros y kilos de tela requeridos para `totalReq` piezas. Los metros
 * solo se calculan si el ítem de BOM está expresado en metros (nunca se
 * reinterpreta otra unidad); los kilos usan la misma fórmula de Materia
 * Prima (gramaje × ancho × metros / 1000) y quedan en null si falta
 * gramaje o ancho — nunca se inventa un valor.
 */
function computeFabricRequirement(
  fabricItem: Awaited<ReturnType<typeof findFabricBomItem>>,
  totalReq: number,
) {
  if (!fabricItem || !fabricItem.rawMaterial) {
    return { codigoTela: null, tela: null, telaMetrosRequeridos: null, telaKilosRequeridos: null }
  }

  const isMeters = METER_UNIT_CODES.has(fabricItem.unit.trim().toLowerCase())
  if (!isMeters) {
    return {
      codigoTela: fabricItem.rawMaterial.code,
      tela: fabricItem.rawMaterial.name,
      telaMetrosRequeridos: null,
      telaKilosRequeridos: null,
    }
  }

  const waste = fabricItem.wastePercentage ? Number(fabricItem.wastePercentage) : 0
  const metersRequired = round(totalReq * Number(fabricItem.quantity) * (1 + waste / 100))

  const kilosRequired = computeFabricWeightKg({
    grammage: fabricItem.rawMaterial.grammage !== null ? Number(fabricItem.rawMaterial.grammage) : null,
    grammageUnit: fabricItem.rawMaterial.grammageUnit,
    width: fabricItem.rawMaterial.width !== null ? Number(fabricItem.rawMaterial.width) : null,
    widthUnit: fabricItem.rawMaterial.widthUnit,
    lengthM: metersRequired,
  })

  return {
    codigoTela: fabricItem.rawMaterial.code,
    tela: fabricItem.rawMaterial.name,
    telaMetrosRequeridos: metersRequired,
    telaKilosRequeridos: kilosRequired,
  }
}

interface PieceLike {
  id: number
  code: string
  name: string
  size: string | null
  width: unknown
  length: unknown
  grammage: unknown
  reinforced: boolean
  fenestrated: boolean
  laminated: boolean
  usesAdhesive: boolean
  usesLabel: boolean
  usesBag: boolean
  route: { code: string; name: string } | null
}

export interface OrderStatusRow {
  fCreac: Date
  fReq: Date | null
  fReal: Date | null
  fechaCaducidad: Date | null
  cliente: string
  pedido: string
  ordenCompra: string | null
  lote: string
  loteReferencia: string | null
  codigoKit: string | null
  nombreKit: string | null
  descripcionProducto: string
  m: number | null
  l: number | null
  xl: number | null
  codigoPieza: string
  nombrePieza: string
  codigoTela: string | null
  tela: string | null
  telaMetrosRequeridos: number | null
  telaKilosRequeridos: number | null
  cantidadKit: number
  unidadesXKit: number
  totalReq: number
  refuerzo: boolean
  fenestra: boolean
  laminado: boolean
  adhesivo: boolean
  etiqueta: boolean
  bolsaDeEmpaque: boolean
  aprobacionEtiqueta: string | null
  ruta: string | null
  ancho: number | null
  largo: number | null
  gramaje: number | null
  tiempoEstandar: number | null
  corte: number | null
  pctCorte: number | null
  costura: number | null
  pctCostura: number | null
  empaque: number | null
  pctEmpaque: number | null
  esterilizado: number | null
  pctEsterilizado: number | null
  controlCalidad: number | null
  pctControlCalidad: number | null
  pt: number | null
  pctPt: number | null
  despachado: number | null
  pctDespachado: number | null
  saldo: number | null
  pctSaldo: number | null
}

async function buildRowsForLot(lot: {
  id: number
  quantity: unknown
  lotCode: string
  expirationDate: Date | null
  productId: number
  referenceLot: { lotCode: string } | null
  order: {
    code: string
    createdAt: Date
    requiredDate: Date | null
    purchaseOrderNumber: string | null
    customer: { name: string }
  }
  productionOrder: { id: number; productionDate: Date | null } | null
  labelApproval: { status: string } | null
}): Promise<OrderStatusRow[]> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: lot.productId },
    include: { route: true },
  })

  const statusSummary = lot.productionOrder
    ? await getProductionOrderStatusSummary(lot.productionOrder.id)
    : null

  const corteStep = statusSummary ? matchStep(statusSummary.steps, /corte/i) : null
  const costuraStep = statusSummary ? matchStep(statusSummary.steps, /costura/i) : null
  const empaqueStep = statusSummary ? matchStep(statusSummary.steps, /empaque/i) : null
  const esterilStep = statusSummary ? matchStep(statusSummary.steps, /esteril/i) : null

  const base = {
    fCreac: lot.order.createdAt,
    fReq: lot.order.requiredDate,
    fReal: lot.productionOrder?.productionDate ?? null,
    fechaCaducidad: lot.expirationDate,
    cliente: lot.order.customer.name,
    pedido: lot.order.code,
    ordenCompra: lot.order.purchaseOrderNumber ?? null,
    lote: lot.lotCode,
    loteReferencia: lot.referenceLot?.lotCode ?? null,
    aprobacionEtiqueta: lot.labelApproval?.status ?? null,
  }

  function scaledStep(step: StepProgressSummary | null, multiplier: number) {
    if (!step) return { value: null, pct: null }
    return { value: round(step.accumulatedQuantity * multiplier), pct: step.percentage }
  }

  function buildRowForPiece(piece: PieceLike, multiplier: number, unidadesXKit: number): Omit<
    OrderStatusRow,
    keyof typeof base
  > & typeof base {
    const corte = scaledStep(corteStep, multiplier)
    const costura = scaledStep(costuraStep, multiplier)
    const empaque = scaledStep(empaqueStep, multiplier)
    const esteril = scaledStep(esterilStep, multiplier)
    const quality = statusSummary?.quality
      ? { value: round(statusSummary.quality.quantity * multiplier), pct: statusSummary.quality.percentage }
      : { value: null, pct: null }
    const pt = statusSummary?.finishedProduct
      ? { value: round(statusSummary.finishedProduct.quantity * multiplier), pct: statusSummary.finishedProduct.percentage }
      : { value: null, pct: null }
    const dispatched = statusSummary
      ? { value: round(statusSummary.dispatched.quantity * multiplier), pct: statusSummary.dispatched.percentage }
      : { value: null, pct: null }
    const balance = statusSummary
      ? { value: round(statusSummary.balance.quantity * multiplier), pct: statusSummary.balance.percentage }
      : { value: null, pct: null }

    const size = (piece.size ?? '').trim().toUpperCase()
    const totalReq = round(Number(lot.quantity) * unidadesXKit)

    return {
      ...base,
      codigoKit: product.productType === 'KIT' ? product.code : null,
      nombreKit: product.productType === 'KIT' ? product.name : null,
      descripcionProducto: product.name,
      m: size === 'M' ? totalReq : null,
      l: size === 'L' ? totalReq : null,
      xl: size === 'XL' ? totalReq : null,
      codigoPieza: piece.code,
      nombrePieza: piece.name,
      codigoTela: null,
      tela: null,
      telaMetrosRequeridos: null,
      telaKilosRequeridos: null,
      cantidadKit: round(Number(lot.quantity)),
      unidadesXKit,
      totalReq,
      refuerzo: piece.reinforced,
      fenestra: piece.fenestrated,
      laminado: piece.laminated,
      adhesivo: piece.usesAdhesive,
      etiqueta: piece.usesLabel,
      bolsaDeEmpaque: piece.usesBag,
      ruta: piece.route ? `${piece.route.code} · ${piece.route.name}` : null,
      ancho: piece.width !== null ? Number(piece.width) : null,
      largo: piece.length !== null ? Number(piece.length) : null,
      gramaje: piece.grammage !== null ? Number(piece.grammage) : null,
      tiempoEstandar: null,
      corte: corte.value,
      pctCorte: corte.pct,
      costura: costura.value,
      pctCostura: costura.pct,
      empaque: empaque.value,
      pctEmpaque: empaque.pct,
      esterilizado: esteril.value,
      pctEsterilizado: esteril.pct,
      controlCalidad: quality.value,
      pctControlCalidad: quality.pct,
      pt: pt.value,
      pctPt: pt.pct,
      despachado: dispatched.value,
      pctDespachado: dispatched.pct,
      saldo: balance.value,
      pctSaldo: balance.pct,
    }
  }

  if (product.productType === 'KIT') {
    const header = await prisma.bomHeader.findUnique({
      where: { productId: product.id },
      include: {
        items: {
          include: { componentProduct: { include: { route: true } } },
          orderBy: { sequence: 'asc' },
        },
      },
    })
    const pieceItems = (header?.items ?? []).filter(
      (item) => item.componentType === 'PRODUCT' && item.componentProduct,
    )

    const rows: OrderStatusRow[] = []
    for (const item of pieceItems) {
      const piece = item.componentProduct!
      const unidadesXKit = Number(item.quantity)
      const row = buildRowForPiece(piece as unknown as PieceLike, unidadesXKit, unidadesXKit)
      const fabricItem = await findFabricBomItem(piece.id)
      Object.assign(row, computeFabricRequirement(fabricItem, row.totalReq))
      row.tiempoEstandar = await getStandardTimeTotal(piece.id)
      rows.push(row)
    }
    return rows
  }

  // Individual / semiterminado: una sola fila, la pieza es el propio producto.
  const row = buildRowForPiece(product as unknown as PieceLike, 1, 1)
  const fabricItem = await findFabricBomItem(product.id)
  Object.assign(row, computeFabricRequirement(fabricItem, row.totalReq))
  row.tiempoEstandar = await getStandardTimeTotal(product.id)
  return [row]
}

export type OrderStatusDateField = 'fCreac' | 'fReq' | 'fReal'

export interface OrderStatusFilters {
  lotIds?: number[]
  dateFrom?: Date
  dateTo?: Date
  dateField?: OrderStatusDateField
}

/**
 * El rango de fechas se aplica sobre el campo elegido (creación, requerida
 * o real) — nunca sobre los tres a la vez — y se combina con la selección
 * de lotes si existe. `fReal` filtra por la fecha de producción de la OP:
 * los lotes sin OP o sin esa fecha quedan fuera del rango en vez de
 * inventar un valor.
 */
function buildDateRangeWhere(
  filters: OrderStatusFilters,
): Prisma.LotWhereInput {
  const { dateFrom, dateTo, dateField = 'fCreac' } = filters
  if (!dateFrom && !dateTo) return {}

  const range = businessDateRangeFilter(dateFrom, dateTo)

  if (dateField === 'fReq') return { order: { requiredDate: range } }
  if (dateField === 'fReal') return { productionOrder: { productionDate: range } }
  return { order: { createdAt: range } }
}

export async function buildOrderStatusReport(filters: OrderStatusFilters = {}) {
  const { lotIds } = filters
  const lots = await prisma.lot.findMany({
    where: {
      AND: [
        lotIds && lotIds.length > 0 ? { id: { in: lotIds } } : {},
        buildDateRangeWhere(filters),
      ],
    },
    include: {
      order: { include: { customer: true } },
      referenceLot: true,
      productionOrder: { select: { id: true, productionDate: true } },
      labelApproval: true,
    },
    orderBy: { id: 'asc' },
  })

  const rows: OrderStatusRow[] = []
  for (const lot of lots) {
    const lotRows = await buildRowsForLot(lot)
    rows.push(...lotRows)
  }
  return rows
}
