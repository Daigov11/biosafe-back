/**
 * Claves de periodo puras (sin acceso a base de datos) usadas para agrupar
 * las series Programado/Real del Centro de Control de Producción. Cada
 * clave es ordenable lexicográficamente en orden cronológico ascendente
 * (año, año-mes, año-Sxx ISO, año-mes-día) — el front las formatea a
 * etiquetas en español.
 */

function round(value: number) {
  return Math.round(value * 100) / 100
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function yearKey(date: Date): string {
  return String(date.getFullYear())
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Semana ISO 8601 (lunes a domingo; la semana 1 contiene el primer jueves del año). */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-S${pad2(weekNo)}`
}

/**
 * % de cumplimiento = real / programado × 100. Si no hay programación
 * (`programado <= 0`), el cumplimiento no puede calcularse de forma
 * significativa: se devuelve `null` (nunca 0 ni Infinity) para que el
 * front lo muestre explícitamente como "sin datos", nunca como "0% de
 * cumplimiento" (que sería una cifra inventada / engañosa).
 */
export function compliancePct(programado: number, real: number): number | null {
  if (programado <= 0) return null
  return round((real / programado) * 100)
}
