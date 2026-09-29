/**
 * Cálculos puros (sin base de datos) de cumplimiento Programado vs. Real
 * por FECHA PROGRAMADA — Programación de Planta. Extraídos a un módulo
 * aparte para poder probarlos sin depender de Prisma, mismo criterio que
 * `reports/period.ts` para el Centro de Control de Producción.
 */

function round(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * `plannedDate`/`startDate` (y los `dateFrom`/`dateTo` de un filtro) son
 * valores "de calendario" puros — un date-picker sin hora significativa,
 * coercionados por zod de la misma forma en ambos lados: "2026-09-23" →
 * 2026-09-23T00:00:00.000Z. Se comparan por su día UTC tal cual, NUNCA
 * pasando ambos lados por `businessDateRangeFilter` (eso desplazaría el
 * mismo día dos veces y desalinearía la comparación). Ese helper se
 * reserva para acotar timestamps reales con hora significativa, como
 * `ProductionProgress.date`.
 */
export function dayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export interface ComplianceResult {
  diferencia: number | null
  pctPR: number | null
}

/**
 * DIFERENCIA = PROGRAMADO - REAL (positiva: falta producir; cero:
 * cumplido; negativa: sobreproducción). % P/R = REAL / PROGRAMADO × 100
 * a un decimal. Sin REAL (sin fecha programada o sin OP) no hay nada que
 * calcular — nunca se muestra 0% ni se inventa un valor.
 */
export function computeCompliance(programado: number, real: number | null): ComplianceResult {
  if (real === null) return { diferencia: null, pctPR: null }
  const diferencia = round(programado - real)
  const pctPR = programado > 0 ? Math.round((real / programado) * 1000) / 10 : null
  return { diferencia, pctPR }
}

export type ComplianceState = 'Pendiente' | 'Cumplido' | 'Sobreproducción' | 'Sin programación'

/**
 * Estado accesible de DIFERENCIA — nunca solo color, siempre con texto (y,
 * en pantalla, ícono). Única fuente de verdad para `/planning/plant` y
 * `/reports/plant-programming`: ambas páginas deben mostrar exactamente el
 * mismo estado para el mismo lote/fecha.
 */
export function complianceStateLabel(diferencia: number | null): ComplianceState {
  if (diferencia === null) return 'Sin programación'
  if (diferencia > 0) return 'Pendiente'
  if (diferencia === 0) return 'Cumplido'
  return 'Sobreproducción'
}
