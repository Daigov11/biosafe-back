// Resumen de características derivado siempre de los flags/atributos del
// maestro de Producto — nunca se persiste como texto editable. Se usa en
// tabla de Productos, drawer de Producto, componentes de OP y Situación de
// Pedido para no repetir esta lógica en cada pantalla.

export interface CharacteristicsSource {
  sterile: boolean
  fenestrated: boolean
  reinforced: boolean
  laminated: boolean
  usesAdhesive: boolean
  usesLabel: boolean
  usesBag: boolean
  size: string | null
  width: unknown
  length: unknown
  grammage: unknown
}

function formatNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export function buildCharacteristicsSummary(product: CharacteristicsSource): string[] {
  const tags: string[] = []

  if (product.sterile) tags.push('Estéril')
  if (product.fenestrated) tags.push('Fenestrado')
  if (product.reinforced) tags.push('Reforzado')
  if (product.laminated) tags.push('Laminado')
  if (product.usesAdhesive) tags.push('Con adhesivo')
  if (product.usesLabel) tags.push('Con etiqueta')
  if (product.usesBag) tags.push('Con bolsa')
  if (product.size) tags.push(`Talla ${product.size}`)

  const width = formatNumber(product.width)
  const length = formatNumber(product.length)
  if (width !== null && length !== null) {
    tags.push(`${width}×${length} cm`)
  } else if (width !== null) {
    tags.push(`Ancho ${width} cm`)
  } else if (length !== null) {
    tags.push(`Largo ${length} cm`)
  }

  const grammage = formatNumber(product.grammage)
  if (grammage !== null) tags.push(`${grammage} g/m²`)

  return tags
}

export interface KitPieceLike {
  code: string
  name: string
  quantityPerUnit: number
}

/**
 * Resumen de composición de un kit: cuenta piezas sin repetir los
 * atributos de cada una (esos se consultan siempre desde su propio
 * producto). Ejemplo: "16 piezas — 2× Campo quirúrgico, 1× Bata...".
 */
export function buildKitSummary(pieces: KitPieceLike[]): string | null {
  if (pieces.length === 0) return null
  const totalPieces = pieces.reduce((sum, piece) => sum + piece.quantityPerUnit, 0)
  const parts = pieces.map((piece) => `${piece.quantityPerUnit}× ${piece.name}`)
  return `${totalPieces} piezas — ${parts.join(', ')}`
}
