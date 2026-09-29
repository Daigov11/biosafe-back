// FIXTURE DE PRUEBAS (solo tests; no se compila ni se despliega) — Cotización 3CBIO01-179, PD GLOBAL / AVIVA
// "Kit de laparotomía estéril descartable x 13 piezas", 100 kits.
//
// Reproduce el Excel `Actualizacion - PD GLOBAL - KIT DE LAPAROTOMIA ... 100 KITS.xlsx`
// usando las MISMAS expresiones de sus celdas (no los resultados pegados).
// NO es dato operativo ni se carga en ninguna base: `isFixture = true` impide
// enviarlo o aprobarlo como cotización real. Los valores no confirmados están marcados:
//   · campo 90×90 con paso 0.75 m  → referencia histórica no validada (D7)
//   · adhesivo 1.8·1.18·3.7/(48/x) → "referencia Excel pendiente de validación" (D5)

import type { CostLineInput, KitCostInput } from '../../src/lib/costing/engine.js'

const excel = (
  kind: CostLineInput['kind'],
  label: string,
  amount: number,
  formulaText: string,
  extra: Partial<CostLineInput> = {},
): CostLineInput => ({
  kind,
  label,
  amount,
  formulaText,
  includesTax: kind !== 'LABOR',
  sourceType: 'EXCEL_REFERENCE',
  ...extra,
})

const ADHESIVE_NOTE =
  'Referencia Excel pendiente de validación: Costos no ha confirmado el significado de 3.7, 48 y 0.7.'
const adhesive = (label: string, divisor: number, expr: string) =>
  excel('MATERIAL', label, (1.8 * 1.18 * 3.7) / (48 / divisor), expr, {
    technicalNote: ADHESIVE_NOTE,
    pendingValidation: true,
    historicalReference: true,
    sourceType: 'MANUAL',
  })

export const PD_GLOBAL_QUOTE_CODE = '3CBIO01-179'
export const PD_GLOBAL_KIT_PRODUCT_CODE = 'PT-KLP-0001'

export const pdGlobalFixture: KitCostInput = {
  isFixture: true,
  igvRate: 0.18,
  margin: 0.28,
  quantity: 100,
  sterile: true,
  declaredPieces: 13,
  unitsPerBox: 8,
  unitsPerBag: 8,
  components: [
    {
      code: 'BATA-L-REF',
      name: 'Bata quirúrgica estéril descartable talla L (125 x 155 cm), refuerzo SMS en pecho y mangas, con toalla de mano 20 x 40 cm',
      quantity: 4,
      countsTowardPieces: true,
      costSource: 'SUPPLIER',
      yieldRequired: true,
      yieldValidated: true,
      yieldUnits: 1757,
      supplierData: { supplier: 'Proveedor (cotización histórica Excel)', unitCostWithTax: 2464 / 1757 },
      lines: [
        excel('MATERIAL', 'Rollo Fitesa (2.10 x 2800 m)', 2464 / 1757, '2464 / 1757 (rendimiento directo)'),
        excel('MATERIAL', 'Refuerzo SMS', 0.27, '0.27'),
        excel('LABOR', 'Mano de obra (proveedor)', 1.95 / 1.18, '1.95 / 1.18', { sourceType: 'LABOR_COST' }),
        excel('MATERIAL', 'Tarjeta de transferencia', 0.085, '0.085'),
        excel('MATERIAL', 'Toalla de mano 20 x 40 cm', 0.16, '0.16'),
      ],
    },
    {
      code: 'FUNDA-MAYO-70X120',
      name: 'Funda para mesa de mayo 70 x 120 cm, refuerzo SMS + laminado 60 gr',
      quantity: 1,
      countsTowardPieces: true,
      costSource: 'OWN',
      yieldRequired: true,
      yieldValidated: true,
      lines: [
        excel('MATERIAL', 'Rollo Fitesa', 2464 / ((2750 / 1.2) * 3), '2464 / ((2750 / 1.2) * 3)'),
        excel('MATERIAL', 'Refuerzo laminado 60 gsm', 1380 / ((960 / 1.2) * 3), '1380 / ((960 / 1.2) * 3)'),
        excel('LABOR', 'Mano de obra', 0.6, '0.6'),
        excel('MATERIAL', 'Sticker', 0.061, '0.061'),
      ],
    },
    {
      code: 'CAMPO-90X90-ADH',
      name: 'Campo quirúrgico estéril descartable 90 x 90 cm, adhesivo 1.8 x 70 cm',
      quantity: 4,
      countsTowardPieces: true,
      costSource: 'OWN',
      yieldRequired: true,
      // D7: el paso de 0.75 m es referencia histórica; el rendimiento real está pendiente.
      yieldValidated: false,
      lines: [
        excel('MATERIAL', 'Rollo Fitesa', 2464 / ((2750 / 0.75) * 2), '2464 / ((2750 / 0.75) * 2)', {
          technicalNote: 'Referencia histórica no validada: paso de 0.75 m para pieza de 0.90 m. Pendiente de Ingeniería.',
          historicalReference: true,
          pendingValidation: true,
        }),
        excel('LABOR', 'Mano de obra', 0.2, '0.2'),
        adhesive('Adhesivo 1.8 cm', 0.7, '(1.8 * 1.18 * 3.7) / (48 / 0.7)'),
      ],
    },
    {
      code: 'SABANA-200X150-ADH',
      name: 'Sábana quirúrgica estéril descartable 200 x 150 cm, adhesivo 1.8 x 80 cm (lado de 200 cm)',
      quantity: 2,
      countsTowardPieces: true,
      costSource: 'OWN',
      yieldRequired: true,
      yieldValidated: true,
      lines: [
        excel('MATERIAL', 'Rollo Fitesa', 2464 / (2750 / 1.5), '2464 / (2750 / 1.5)'),
        excel('LABOR', 'Mano de obra', 0.3, '0.3'),
        adhesive('Adhesivo 1.8 cm', 0.8, '(1.8 * 1.18 * 3.7) / (48 / 0.8)'),
      ],
    },
    {
      code: 'PONCHO-200X150-FEN',
      name: 'Poncho quirúrgico estéril descartable 200 x 150 cm, fenestra 21 x 31 cm, adhesivo y 2 bolsillos 30 x 40 cm',
      quantity: 1,
      countsTowardPieces: true,
      costSource: 'OWN',
      yieldRequired: true,
      yieldValidated: true,
      lines: [
        excel(
          'MATERIAL',
          'Rollo Fitesa (cuerpo + 2 bolsillos)',
          2464 / (2750 / 1.5) + (2464 / ((2750 / 0.4) * 7)) * 2,
          '2464 / (2750 / 1.5) + (2464 / ((2750 / 0.4) * 7)) * 2',
        ),
        excel('LABOR', 'Mano de obra', 1, '1'),
        adhesive('Adhesivo 1.8 cm', 1.25, '(1.8 * 1.18 * 3.7) / (48 / 1.25)'),
        excel('MATERIAL', 'Sticker', 0.061 + 0.081, '0.061 + 0.081'),
      ],
    },
    {
      code: 'ENVOLTORIO-210X150',
      name: 'Envoltorio de 210 x 150 cm en laminado de 60 gr',
      quantity: 1,
      countsTowardPieces: true,
      costSource: 'OWN',
      yieldRequired: true,
      yieldValidated: true,
      lines: [
        excel('MATERIAL', 'Refuerzo laminado 60 gsm', 1380 / (960 / 1.5), '1380 / (960 / 1.5)'),
        excel('LABOR', 'Mano de obra', 0.25, '0.25'),
      ],
    },
    {
      code: 'INDICADOR-QUIMICO',
      name: 'Indicador químico',
      quantity: 1,
      // El Excel suma 14, pero el título y la marcación comercial son 13 piezas.
      countsTowardPieces: false,
      costSource: 'OWN',
      laborRequired: false,
      lines: [excel('MATERIAL', 'Indicador químico', 0.095, '0.095')],
    },
  ],
  kitLines: [
    excel('PACKAGING', 'Peel Open (43 cm x 200 m) + corte + impresión', 162 / (180 / 0.6) + 0.021 + 0.008, '(162 / (180 / 0.6)) + 0.021 + 0.008', {
      serviceCategory: 'PEEL_OPEN',
    }),
    excel('PACKAGING', 'Sticker para kit', 1.1, '1.10', { serviceCategory: 'STICKER' }),
    excel('LABOR', 'Preparación de un pack', 0.7, '0.70', { serviceCategory: 'PACK_PREPARATION' }),
    excel('PACKAGING', 'Caja BSI regular (8 por caja)', 5.18 / 8, '5.18 / 8', { serviceCategory: 'BOX' }),
    excel('PACKAGING', 'Sticker caja (8 por caja)', 1.427 / 8, '1.427 / 8', { serviceCategory: 'BOX_STICKER' }),
    excel('SERVICE', 'Esterilización ETO (8 por bolsa)', 31 / 8, '31 / 8', { serviceCategory: 'STERILIZATION' }),
  ],
}

/** Valores del Excel (celdas W21, X21, Y21, Z21) — solo para la prueba de paridad. */
export const PD_GLOBAL_EXPECTED = {
  costWithTax: 34.3907,
  costWithoutTax: 30.7555,
  priceWithoutTax: 42.716,
  priceWithTax: 50.4049,
}
