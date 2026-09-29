// Aptitud de una cotización para ENVIARSE/APROBARSE — FUNCIÓN PURA.
// Un BORRADOR puede guardarse con faltantes; enviar, aprobar o generar pedido
// exige `canSend === true`. Cada bloqueo indica producto, dato faltante y
// responsable, para mostrar la alerta detallada.

import type { ComponentInput, KitCostInput } from './engine.js'

export type BlockerCode =
  | 'NO_COMPONENTS'
  | 'NO_COST_LINES'
  | 'NO_LABOR_COST'
  | 'NO_ROUTE_OR_STANDARD_TIME'
  | 'YIELD_NOT_VALIDATED'
  | 'PENDING_VALIDATION_LINE'
  | 'HISTORICAL_REFERENCE_LINE'
  | 'FIXTURE_NOT_APPROVABLE'
  | 'SUPPLIER_DATA_MISSING'
  | 'SUPPLIER_QUOTE_EXPIRED'
  | 'NO_PACKAGING'
  | 'NO_STERILIZATION'
  | 'NO_PACK_PARAMETERS'
  | 'PIECES_MISMATCH'
  | 'MARGIN_OUT_OF_RANGE'

export type BlockerOwner = 'Costos' | 'Ingeniería' | 'Comercial' | 'Dirección'

export interface Blocker {
  code: BlockerCode
  message: string
  owner: BlockerOwner
  productCode?: string
  productName?: string
}

export interface Readiness {
  canSend: boolean
  blockers: Blocker[]
}

function componentBlockers(component: ComponentInput, today: Date): Blocker[] {
  const out: Blocker[] = []
  const at = { productCode: component.code, productName: component.name }

  if (component.lines.length === 0) {
    out.push({ code: 'NO_COST_LINES', owner: 'Costos', ...at, message: 'No tiene líneas de costo (materiales, insumos ni mano de obra).' })
  }

  const hasLabor = component.lines.some((l) => l.kind === 'LABOR')
  if ((component.laborRequired ?? true) && !hasLabor) {
    out.push({ code: 'NO_LABOR_COST', owner: 'Costos', ...at, message: 'Falta el costo de mano de obra o de proveedor.' })
  }

  if (component.costSource === 'OWN' && component.routeAndStandardTimeDefined === false) {
    out.push({ code: 'NO_ROUTE_OR_STANDARD_TIME', owner: 'Ingeniería', ...at, message: 'Fabricación propia sin ruta/operación o tiempo estándar.' })
  }

  if (component.yieldRequired && !component.yieldValidated) {
    out.push({ code: 'YIELD_NOT_VALIDATED', owner: 'Ingeniería', ...at, message: 'El rendimiento no está validado por Ingeniería.' })
  }

  for (const line of component.lines) {
    if (line.pendingValidation) {
      out.push({ code: 'PENDING_VALIDATION_LINE', owner: 'Costos', ...at, message: `La línea "${line.label}" está pendiente de validación de fórmula oficial.` })
    }
    if (line.historicalReference) {
      out.push({ code: 'HISTORICAL_REFERENCE_LINE', owner: 'Ingeniería', ...at, message: `La línea "${line.label}" usa una referencia histórica no validada.` })
    }
  }

  if (component.costSource === 'SUPPLIER') {
    const s = component.supplierData
    const missing: string[] = []
    if (!s?.supplier) missing.push('proveedor')
    if (!s?.validFrom || !s?.validUntil) missing.push('vigencia')
    if (s?.unitCostWithTax === undefined && s?.unitCostWithoutTax === undefined) missing.push('costo con/sin IGV')
    if (!s?.evidence) missing.push('evidencia/observación de la cotización del proveedor')
    if (missing.length > 0) {
      out.push({ code: 'SUPPLIER_DATA_MISSING', owner: 'Costos', ...at, message: `Componente de proveedor sin: ${missing.join(', ')}.` })
    } else if (s?.validUntil && new Date(s.validUntil).getTime() < today.getTime()) {
      out.push({ code: 'SUPPLIER_QUOTE_EXPIRED', owner: 'Costos', ...at, message: `La cotización del proveedor venció el ${s.validUntil}.` })
    }
  }

  return out
}

export function assessReadiness(input: KitCostInput, today: Date = new Date()): Readiness {
  const blockers: Blocker[] = []

  if (input.isFixture) {
    blockers.push({
      code: 'FIXTURE_NOT_APPROVABLE',
      owner: 'Dirección',
      message: 'Datos de validación histórica (fixture): no pueden usarse en cotizaciones reales.',
    })
  }

  if (input.components.length === 0) {
    blockers.push({ code: 'NO_COMPONENTS', owner: 'Ingeniería', message: 'El kit no tiene componentes activos.' })
  }

  for (const component of input.components) blockers.push(...componentBlockers(component, today))

  const pieces = input.components
    .filter((c) => c.countsTowardPieces)
    .reduce((sum, c) => sum + c.quantity, 0)
  if (input.declaredPieces !== undefined && pieces !== input.declaredPieces) {
    blockers.push({
      code: 'PIECES_MISMATCH',
      owner: 'Ingeniería',
      message: `El kit declara ${input.declaredPieces} piezas pero la marcación de piezas comerciales suma ${pieces}.`,
    })
  }

  const hasPackaging = input.kitLines.some(
    (l) => l.kind === 'PACKAGING' || l.serviceCategory === 'BOX' || l.serviceCategory === 'PEEL_OPEN',
  )
  if (!hasPackaging) {
    blockers.push({ code: 'NO_PACKAGING', owner: 'Costos', message: 'El kit no tiene empaque definido (peel open, caja).' })
  }
  if (input.sterile && !input.kitLines.some((l) => l.serviceCategory === 'STERILIZATION')) {
    blockers.push({ code: 'NO_STERILIZATION', owner: 'Costos', message: 'El kit es estéril pero no tiene servicio de esterilización.' })
  }
  if (!input.unitsPerBox || (input.sterile && !input.unitsPerBag)) {
    blockers.push({
      code: 'NO_PACK_PARAMETERS',
      owner: 'Ingeniería',
      message: 'Faltan parámetros de presentación (kits por caja y, si es estéril, kits por bolsa).',
    })
  }

  for (const line of input.kitLines) {
    if (line.pendingValidation) {
      blockers.push({ code: 'PENDING_VALIDATION_LINE', owner: 'Costos', message: `La línea de kit "${line.label}" está pendiente de validación.` })
    }
  }

  if (input.authorizedMargin) {
    const { min, max } = input.authorizedMargin
    if (input.margin < min || input.margin > max) {
      blockers.push({
        code: 'MARGIN_OUT_OF_RANGE',
        owner: 'Dirección',
        message: `El margen está fuera del rango autorizado (${min * 100} %–${max * 100} %): requiere precio excepcional aprobado.`,
      })
    }
  }

  return { canSend: blockers.length === 0, blockers }
}
