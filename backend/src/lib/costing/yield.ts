// Rendimiento (unidades por rollo). El valor OFICIAL lo ingresa y valida
// Ingeniería a mano; la sugerencia calculada es solo una ayuda y nunca lo
// reemplaza automáticamente (D4).

export interface YieldSuggestionInput {
  usableRollWidth: number
  usableRollLength: number
  pieceWidth: number
  pieceLength: number
  /** Piezas que caben a lo ancho; si se omite, ⌊ancho útil / ancho de pieza⌋. */
  piecesAcross?: number
  /** Avance real por pieza en el largo (tizado). Si se omite, el largo de la pieza. */
  lengthStep?: number
}

export function suggestUnitsPerRoll(input: YieldSuggestionInput): number {
  const { usableRollWidth, usableRollLength, pieceWidth, pieceLength } = input
  for (const [name, value] of Object.entries({ usableRollWidth, usableRollLength, pieceWidth, pieceLength })) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} debe ser mayor a 0`)
  }
  const across = input.piecesAcross ?? Math.floor(usableRollWidth / pieceWidth)
  const step = input.lengthStep ?? pieceLength
  return Math.floor(usableRollLength / step) * Math.max(across, 0)
}

export class YieldValidationError extends Error {}

/**
 * Valida el registro de un rendimiento oficial. Si difiere de la sugerencia
 * hay que dejar motivo; siempre se exige el responsable que valida.
 */
export function assertYieldOverrideIsJustified(params: {
  officialUnitsPerRoll: number
  suggestedUnitsPerRoll?: number | null
  reason?: string | null
  validatedById?: number | null
}) {
  if (!Number.isInteger(params.officialUnitsPerRoll) || params.officialUnitsPerRoll <= 0) {
    throw new YieldValidationError('El rendimiento debe ser un entero mayor a 0')
  }
  if (!params.validatedById) {
    throw new YieldValidationError('El rendimiento debe registrar al responsable que lo valida')
  }
  const differs =
    params.suggestedUnitsPerRoll != null && params.suggestedUnitsPerRoll !== params.officialUnitsPerRoll
  if (differs && !params.reason?.trim()) {
    throw new YieldValidationError(
      'El rendimiento difiere de la sugerencia calculada: indica el motivo del cambio',
    )
  }
}
