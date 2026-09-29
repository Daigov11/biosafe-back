// Motor de cálculo de la cotización técnico-comercial — FUNCIÓN PURA.
// Sin base de datos, sin reloj, sin redondeo intermedio (D6): solo la capa de
// presentación redondea (`roundForDisplay`). Replica las fórmulas reales de la
// plantilla `3CBIO01-179`:
//
//   costoSinIGV  = Σ(líneas con IGV) / (1 + IGV) + Σ(líneas sin IGV)
//   costoConIGV  = Σ(líneas con IGV) + Σ(líneas sin IGV)   ← igual que la plantilla:
//                  la mano de obra (sin IGV) se suma tal cual, no se le agrega IGV
//   precioSinIGV = costoSinIGV / (1 − margen)               ← margen SOBRE EL PRECIO
//   precioConIGV = precioSinIGV × (1 + IGV)

export type CostLineKind = 'MATERIAL' | 'LABOR' | 'SERVICE' | 'PACKAGING'
export type CostSource = 'OWN' | 'SUPPLIER'
export type ServiceCategory =
  | 'PEEL_OPEN'
  | 'STICKER'
  | 'PACK_PREPARATION'
  | 'BOX'
  | 'BOX_STICKER'
  | 'STERILIZATION'
  | 'OTHER'

export interface CostLineInput {
  kind: CostLineKind
  label: string
  /** Importe por UNA unidad del componente (o por kit si es línea de kit). */
  amount: number
  /** Si el importe ya incluye IGV. La mano de obra va siempre sin IGV. */
  includesTax: boolean
  /** Fórmula visible (p.ej. "2464 / 1757") — trazabilidad, no se evalúa. */
  formulaText?: string
  technicalNote?: string
  /** Fuente del dato: MATERIAL_COST, SERVICE_COST, LABOR_COST, MANUAL, EXCEL_REFERENCE. */
  sourceType: string
  sourceId?: number
  serviceCategory?: ServiceCategory
  /** Costos confirma la fórmula oficial: mientras sea true, bloquea enviar/aprobar. */
  pendingValidation?: boolean
  /** Valor tomado de una referencia histórica no validada (fixture). */
  historicalReference?: boolean
}

export interface SupplierData {
  supplier?: string
  validFrom?: string
  validUntil?: string
  evidence?: string
  unitCostWithTax?: number
  unitCostWithoutTax?: number
}

export interface ComponentInput {
  code: string
  name: string
  quantity: number
  /** Cuenta para el total de piezas comerciales del kit (`countsTowardKitPieces`). */
  countsTowardPieces: boolean
  costSource: CostSource
  supplierData?: SupplierData
  lines: CostLineInput[]
  /** Mano de obra obligatoria (false p.ej. para un indicador químico comprado). */
  laborRequired?: boolean
  /** Consume rollo/tela: exige rendimiento validado por Ingeniería. */
  yieldRequired?: boolean
  yieldValidated?: boolean
  yieldUnits?: number
  /** Componente de fabricación propia: exige ruta y tiempo estándar. */
  routeAndStandardTimeDefined?: boolean
}

export interface KitCostInput {
  igvRate: number
  /** Margen sobre precio, fracción: 0.28 = 28 %. */
  margin: number
  quantity: number
  components: ComponentInput[]
  kitLines: CostLineInput[]
  sterile?: boolean
  declaredPieces?: number
  unitsPerBox?: number
  unitsPerBag?: number
  /** Dato de validación histórica (nunca aprobable como cotización real). */
  isFixture?: boolean
  /** Rango de margen autorizado para Comercial (fracciones). */
  authorizedMargin?: { min: number; max: number }
}

export interface ComponentResult {
  code: string
  name: string
  quantity: number
  /** Σ(importes de una unidad) × cantidad, tal como la columna "Sub Costo" de la plantilla. */
  subtotal: number
  laborSubtotal: number
  lines: CostLineInput[]
}

export interface KitCostResult {
  components: ComponentResult[]
  piecesCount: number
  componentsSubtotal: number
  kitLinesSubtotal: number
  laborTotal: number
  /** "Costo Soles con IGV" (W21). */
  costWithTax: number
  /** "Costo Soles sin IGV" (X21). */
  costWithoutTax: number
  /** Precio unitario sin IGV (Y21). */
  priceWithoutTax: number
  /** Precio unitario con IGV (Z21). */
  priceWithTax: number
  quantity: number
  totalWithoutTax: number
  totalWithTax: number
}

export class CostingInputError extends Error {}

function assertFinite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new CostingInputError(`${name} no es un número válido`)
}

export function calculateKitCost(input: KitCostInput): KitCostResult {
  const { igvRate, margin, quantity } = input
  assertFinite(igvRate, 'IGV')
  assertFinite(margin, 'Margen')
  assertFinite(quantity, 'Cantidad')
  if (igvRate < 0) throw new CostingInputError('El IGV no puede ser negativo')
  // Margen sobre precio: con 100 % el precio sería infinito.
  if (margin < 0 || margin >= 1) {
    throw new CostingInputError('El margen debe estar entre 0 % y 100 % (sin incluir 100 %)')
  }
  if (quantity <= 0) throw new CostingInputError('La cantidad debe ser mayor a 0')

  let taxedTotal = 0
  let untaxedTotal = 0
  let laborTotal = 0

  const accumulate = (line: CostLineInput, multiplier: number) => {
    assertFinite(line.amount, `Importe de "${line.label}"`)
    const value = line.amount * multiplier
    if (line.includesTax) taxedTotal += value
    else untaxedTotal += value
    if (line.kind === 'LABOR') laborTotal += value
  }

  let piecesCount = 0
  let componentsSubtotal = 0
  const components: ComponentResult[] = input.components.map((component) => {
    assertFinite(component.quantity, `Cantidad de "${component.name}"`)
    let subtotal = 0
    let laborSubtotal = 0
    for (const line of component.lines) {
      accumulate(line, component.quantity)
      subtotal += line.amount * component.quantity
      if (line.kind === 'LABOR') laborSubtotal += line.amount * component.quantity
    }
    if (component.countsTowardPieces) piecesCount += component.quantity
    componentsSubtotal += subtotal
    return {
      code: component.code,
      name: component.name,
      quantity: component.quantity,
      subtotal,
      laborSubtotal,
      lines: component.lines,
    }
  })

  let kitLinesSubtotal = 0
  for (const line of input.kitLines) {
    accumulate(line, 1)
    kitLinesSubtotal += line.amount
  }

  const costWithTax = taxedTotal + untaxedTotal
  const costWithoutTax = taxedTotal / (1 + igvRate) + untaxedTotal
  const priceWithoutTax = costWithoutTax / (1 - margin)
  const priceWithTax = priceWithoutTax * (1 + igvRate)

  return {
    components,
    piecesCount,
    componentsSubtotal,
    kitLinesSubtotal,
    laborTotal,
    costWithTax,
    costWithoutTax,
    priceWithoutTax,
    priceWithTax,
    quantity,
    totalWithoutTax: priceWithoutTax * quantity,
    totalWithTax: priceWithTax * quantity,
  }
}

/** Redondeo exclusivo de presentación (interfaz, PDF, Excel): 2 decimales. */
export function roundForDisplay(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Texto para la pantalla: evita leer el 28 % como recargo sobre costo. */
export function describeMargin(margin: number): string {
  const pct = roundForDisplay(margin * 100, 2)
  const markup = margin < 1 ? roundForDisplay((margin / (1 - margin)) * 100, 1) : Infinity
  return `Margen ${pct} % sobre el precio de venta (equivale a un recargo de ${markup} % sobre el costo)`
}
