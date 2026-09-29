/**
 * Rango de fechas Desde/Hasta de negocio (Dashboard, Situación de Pedido y
 * cualquier otro reporte que filtre por un rango de días) — zona horaria
 * America/Lima. Perú no observa horario de verano: el offset UTC-5 es
 * constante todo el año, así que no hace falta una librería de zonas
 * horarias para este cálculo.
 *
 * `dateFrom`/`dateTo` llegan ya coercionados por zod desde un input
 * `type="date"` (p.ej. "2026-09-24" → 2026-09-24T00:00:00.000Z): sus
 * componentes año/mes/día en UTC son exactamente los que el usuario
 * escribió, así que se leen con los getters UTC y se reinterpretan como
 * medianoche en Lima (nunca como medianoche UTC, que corresponde a las
 * 19:00 hora de Lima del día anterior y excluía registros creados esa
 * misma tarde/noche).
 */

const LIMA_UTC_OFFSET_HOURS = 5

function limaDayStartUtc(date: Date, dayOffset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + dayOffset, LIMA_UTC_OFFSET_HOURS))
}

export interface BusinessDateRangeFilter {
  gte?: Date
  lt?: Date
}

/**
 * `dateFrom`: inicio del día seleccionado (00:00 Lima). `dateTo`: límite
 * EXCLUSIVO del día siguiente (00:00 Lima del día después de `dateTo`) —
 * así el rango incluye todo el día `dateTo`, de madrugada a medianoche,
 * sin usar `lte` con medianoche.
 */
export function businessDateRangeFilter(dateFrom?: Date, dateTo?: Date): BusinessDateRangeFilter {
  return {
    ...(dateFrom ? { gte: limaDayStartUtc(dateFrom) } : {}),
    ...(dateTo ? { lt: limaDayStartUtc(dateTo, 1) } : {}),
  }
}
