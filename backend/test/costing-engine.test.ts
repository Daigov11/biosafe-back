import { describe, expect, it } from 'vitest'
import {
  CostingInputError,
  calculateKitCost,
  describeMargin,
  roundForDisplay,
  type KitCostInput,
} from '../src/lib/costing/engine.js'
import { assessReadiness } from '../src/lib/costing/readiness.js'
import {
  PD_GLOBAL_EXPECTED,
  pdGlobalFixture,
} from './fixtures/pd-global-3cbio01-179.js'

/**
 * Paridad con el Excel `3CBIO01-179` (PD GLOBAL / AVIVA). Los valores esperados
 * son los de las celdas W21, X21, Y21 y Z21, recalculados desde sus fórmulas.
 */
describe('motor de costeo — paridad con el Excel PD GLOBAL', () => {
  const result = calculateKitCost(pdGlobalFixture)

  it('costo con IGV (W21) = 34.3907', () => {
    expect(result.costWithTax).toBeCloseTo(PD_GLOBAL_EXPECTED.costWithTax, 4)
  })
  it('costo sin IGV (X21) = 30.7555', () => {
    expect(result.costWithoutTax).toBeCloseTo(PD_GLOBAL_EXPECTED.costWithoutTax, 4)
  })
  it('precio sin IGV (Y21) = 42.7160', () => {
    expect(result.priceWithoutTax).toBeCloseTo(PD_GLOBAL_EXPECTED.priceWithoutTax, 4)
  })
  it('precio final con IGV (Z21) = 50.4049', () => {
    expect(result.priceWithTax).toBeCloseTo(PD_GLOBAL_EXPECTED.priceWithTax, 4)
  })

  it('subtotales por componente coinciden con la columna "Sub Costo" (P14:P20)', () => {
    const expected = [14.279731, 1.5944, 2.60243, 3.54996, 2.793056, 2.40625, 0.095]
    result.components.forEach((c, i) => expect(c.subtotal).toBeCloseTo(expected[i], 4))
    expect(result.componentsSubtotal).toBeCloseTo(27.320827, 4) // P21
  })

  it('mano de obra total (K21) = 10.5602 incluyendo preparación de pack', () => {
    expect(result.laborTotal).toBeCloseTo(10.560169, 4)
  })

  it('servicios del kit: Q21…V21', () => {
    const by = Object.fromEntries(pdGlobalFixture.kitLines.map((l) => [l.serviceCategory, l.amount]))
    expect(by.PEEL_OPEN).toBeCloseTo(0.569, 4)
    expect(by.BOX).toBeCloseTo(0.6475, 4)
    expect(by.BOX_STICKER).toBeCloseTo(0.178375, 4)
    expect(by.STERILIZATION).toBeCloseTo(3.875, 4)
  })

  it('cuenta 13 piezas comerciales (el Excel suma 14 por el indicador químico)', () => {
    expect(result.piecesCount).toBe(13)
    const excelSum = pdGlobalFixture.components.reduce((s, c) => s + c.quantity, 0)
    expect(excelSum).toBe(14)
  })

  it('total por cantidad: 100 kits × 50.4049 (derivado, no está en el Excel)', () => {
    expect(result.totalWithTax).toBeCloseTo(5040.4907, 3)
  })
})

describe('motor de costeo — reglas de negocio (D2, D6)', () => {
  const base: KitCostInput = {
    igvRate: 0.18,
    margin: 0.28,
    quantity: 1,
    components: [],
    kitLines: [
      { kind: 'MATERIAL', label: 'material', amount: 118, includesTax: true, sourceType: 'MANUAL' },
      { kind: 'LABOR', label: 'mano de obra', amount: 10, includesTax: false, sourceType: 'MANUAL' },
    ],
  }

  it('margen SOBRE PRECIO: precio = costo / (1 − margen), no costo × 1.28', () => {
    const r = calculateKitCost(base)
    expect(r.costWithoutTax).toBeCloseTo(100 + 10, 10)
    expect(r.priceWithoutTax).toBeCloseTo(110 / 0.72, 10)
    expect(r.priceWithoutTax).not.toBeCloseTo(110 * 1.28, 2)
  })

  it('la mano de obra no lleva IGV en el costo sin IGV', () => {
    const r = calculateKitCost(base)
    expect(r.costWithTax).toBe(128) // 118 + 10, igual que la plantilla
    expect(r.costWithoutTax).toBeCloseTo(110, 10)
  })

  it('precio con IGV = precio sin IGV × (1 + IGV)', () => {
    const r = calculateKitCost(base)
    expect(r.priceWithTax).toBeCloseTo(r.priceWithoutTax * 1.18, 10)
  })

  it('el IGV es parámetro, no constante', () => {
    const r = calculateKitCost({ ...base, igvRate: 0.1 })
    expect(r.costWithoutTax).toBeCloseTo(118 / 1.1 + 10, 10)
  })

  it('no redondea líneas intermedias: solo la presentación redondea a 2 decimales', () => {
    const r = calculateKitCost({
      ...base,
      kitLines: [{ kind: 'MATERIAL', label: 'x', amount: 0.3333333, includesTax: true, sourceType: 'MANUAL' }],
    })
    expect(r.costWithTax).toBe(0.3333333)
    expect(roundForDisplay(50.40490694)).toBe(50.4)
    expect(roundForDisplay(30.755536)).toBe(30.76)
  })

  it('rechaza margen ≥ 100 %, negativo, cantidad ≤ 0 e importes no numéricos', () => {
    expect(() => calculateKitCost({ ...base, margin: 1 })).toThrow(CostingInputError)
    expect(() => calculateKitCost({ ...base, margin: -0.1 })).toThrow(CostingInputError)
    expect(() => calculateKitCost({ ...base, quantity: 0 })).toThrow(CostingInputError)
    expect(() =>
      calculateKitCost({ ...base, kitLines: [{ ...base.kitLines[0], amount: NaN }] }),
    ).toThrow(CostingInputError)
  })

  it('la pantalla explica que el margen es sobre el precio', () => {
    expect(describeMargin(0.28)).toContain('28 % sobre el precio de venta')
    expect(describeMargin(0.28)).toContain('38.9 % sobre el costo')
  })
})

describe('aptitud para enviar/aprobar — el fixture NUNCA es aprobable', () => {
  const codes = (input: KitCostInput) => assessReadiness(input).blockers.map((b) => b.code)

  it('el fixture PD GLOBAL queda bloqueado por ser dato histórico', () => {
    const r = assessReadiness(pdGlobalFixture)
    expect(r.canSend).toBe(false)
    expect(codes(pdGlobalFixture)).toContain('FIXTURE_NOT_APPROVABLE')
  })

  it('D5: la línea de adhesivo pendiente de validación bloquea', () => {
    const b = assessReadiness(pdGlobalFixture).blockers.filter((x) => x.code === 'PENDING_VALIDATION_LINE')
    expect(b.length).toBeGreaterThanOrEqual(3) // campo, sábana y poncho
    expect(b.some((x) => x.message.includes('Adhesivo'))).toBe(true)
  })

  it('D7: el campo 90×90 con rendimiento no validado bloquea e indica el producto', () => {
    const b = assessReadiness(pdGlobalFixture).blockers.find(
      (x) => x.code === 'YIELD_NOT_VALIDATED' && x.productCode === 'CAMPO-90X90-ADH',
    )
    expect(b?.owner).toBe('Ingeniería')
  })

  it('aunque se quite el marcador fixture, siguen bloqueando adhesivo y rendimiento (defensa en profundidad)', () => {
    const noFixture = { ...pdGlobalFixture, isFixture: false }
    const c = codes(noFixture)
    expect(c).not.toContain('FIXTURE_NOT_APPROVABLE')
    expect(c).toContain('PENDING_VALIDATION_LINE')
    expect(c).toContain('YIELD_NOT_VALIDATED')
    expect(c).toContain('HISTORICAL_REFERENCE_LINE')
  })

  it('D8: componente de proveedor sin vigencia ni evidencia bloquea; vencido también', () => {
    const supplier = pdGlobalFixture.components[0]
    expect(codes(pdGlobalFixture)).toContain('SUPPLIER_DATA_MISSING')
    const complete = {
      ...pdGlobalFixture,
      components: [
        {
          ...supplier,
          supplierData: {
            supplier: 'Proveedor SAC',
            validFrom: '2026-09-01',
            validUntil: '2026-09-15',
            unitCostWithTax: 3,
            evidence: 'Cotización 123',
          },
        },
      ],
    }
    const expired = assessReadiness(complete, new Date('2026-09-30')).blockers.map((b) => b.code)
    expect(expired).toContain('SUPPLIER_QUOTE_EXPIRED')
    expect(expired).not.toContain('SUPPLIER_DATA_MISSING')
  })

  it('un kit completo y validado SÍ puede enviarse', () => {
    const ok: KitCostInput = {
      igvRate: 0.18,
      margin: 0.28,
      quantity: 10,
      sterile: true,
      unitsPerBox: 8,
      unitsPerBag: 8,
      declaredPieces: 1,
      components: [
        {
          code: 'C-1',
          name: 'Campo',
          quantity: 1,
          countsTowardPieces: true,
          costSource: 'OWN',
          yieldRequired: true,
          yieldValidated: true,
          routeAndStandardTimeDefined: true,
          lines: [
            { kind: 'MATERIAL', label: 'SMS', amount: 1, includesTax: true, sourceType: 'MATERIAL_COST' },
            { kind: 'LABOR', label: 'MO', amount: 0.3, includesTax: false, sourceType: 'LABOR_COST' },
          ],
        },
      ],
      kitLines: [
        { kind: 'PACKAGING', label: 'Caja', amount: 0.6, includesTax: true, sourceType: 'SERVICE_COST', serviceCategory: 'BOX' },
        { kind: 'SERVICE', label: 'ETO', amount: 3, includesTax: true, sourceType: 'SERVICE_COST', serviceCategory: 'STERILIZATION' },
      ],
    }
    const r = assessReadiness(ok)
    expect(r.blockers).toEqual([])
    expect(r.canSend).toBe(true)
  })

  it('faltantes de kit: sin empaque, sin esterilización, sin parámetros de caja', () => {
    const c = codes({
      igvRate: 0.18,
      margin: 0.3,
      quantity: 1,
      sterile: true,
      components: pdGlobalFixture.components.slice(1, 2),
      kitLines: [],
    })
    expect(c).toEqual(expect.arrayContaining(['NO_PACKAGING', 'NO_STERILIZATION', 'NO_PACK_PARAMETERS']))
  })

  it('margen fuera del rango autorizado bloquea salvo precio excepcional', () => {
    const c = codes({ ...pdGlobalFixture, margin: 0.1, authorizedMargin: { min: 0.2, max: 0.4 } })
    expect(c).toContain('MARGIN_OUT_OF_RANGE')
  })
})
