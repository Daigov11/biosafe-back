// Fórmula única de conversión metros ⇄ kilos para telas, usada tanto por
// Materia Prima (peso teórico por rollo) como por Situación de Pedido
// (kilos requeridos). Nunca se duplica el cálculo en otro lugar.
//
//   kg = gramaje_g_m2 × ancho_m × largo_m / 1000
//
// Solo se calcula cuando gramaje y ancho están expresados en las unidades
// esperadas (o sin unidad registrada, asumiendo la convención del
// catálogo). Si las unidades declaradas son otras, se retorna null en vez
// de inventar una conversión incorrecta.

const EXPECTED_GRAMMAGE_UNIT = 'g/m²'
const EXPECTED_WIDTH_UNIT = 'm'

export interface FabricWeightInput {
  grammage: number | null
  grammageUnit?: string | null
  width: number | null
  widthUnit?: string | null
  lengthM: number | null
}

export function computeFabricWeightKg(input: FabricWeightInput): number | null {
  const { grammage, grammageUnit, width, widthUnit, lengthM } = input
  if (grammage === null || width === null || lengthM === null) return null
  if (grammageUnit && grammageUnit.trim() !== EXPECTED_GRAMMAGE_UNIT) return null
  if (widthUnit && widthUnit.trim() !== EXPECTED_WIDTH_UNIT) return null

  const kg = (grammage * width * lengthM) / 1000
  return Math.round(kg * 1000) / 1000
}
