import { describe, expect, it } from 'vitest'
import { compliancePct, dayKey, isoWeekKey, monthKey, yearKey } from '../src/modules/reports/period.js'

/**
 * Pruebas puras (sin base de datos) de las claves de periodo y el cálculo
 * de cumplimiento que alimentan el Centro de Control de Producción
 * (Iteración 15). Cubren el invariante central: nunca dividir por cero ni
 * inventar un porcentaje cuando no hay programación.
 */

describe('period keys (Centro de Control de Producción)', () => {
  it('yearKey / monthKey / dayKey producen claves ordenables cronológicamente', () => {
    const a = new Date('2026-01-05T10:00:00.000Z')
    const b = new Date('2026-09-24T23:00:00.000Z')

    expect(yearKey(a)).toBe('2026')
    expect(monthKey(a)).toBe('2026-01')
    expect(dayKey(a)).toBe('2026-01-05')

    expect(yearKey(b)).toBe('2026')
    expect(monthKey(b) > monthKey(a)).toBe(true)
    expect(dayKey(b) > dayKey(a)).toBe(true)
  })

  it('isoWeekKey agrupa un lunes y su domingo en la misma semana ISO', () => {
    // Lunes 21/9/2026 y domingo 27/9/2026 (misma semana ISO).
    const monday = new Date('2026-09-21T12:00:00.000Z')
    const sunday = new Date('2026-09-27T12:00:00.000Z')
    expect(isoWeekKey(monday)).toBe(isoWeekKey(sunday))
    expect(isoWeekKey(monday)).toMatch(/^2026-S\d{2}$/)
  })

  it('isoWeekKey distingue semanas ISO consecutivas', () => {
    const week1 = new Date('2026-09-21T12:00:00.000Z')
    const week2 = new Date('2026-09-28T12:00:00.000Z')
    expect(isoWeekKey(week1)).not.toBe(isoWeekKey(week2))
  })
})

describe('compliancePct (Centro de Control de Producción)', () => {
  it('calcula real/programado × 100 redondeado a 2 decimales', () => {
    expect(compliancePct(100, 85)).toBe(85)
    expect(compliancePct(3, 1)).toBe(33.33)
  })

  it('real >= programado da >= 100% (sobreproducción visible, no se recorta)', () => {
    expect(compliancePct(100, 120)).toBe(120)
  })

  it('sin programación (programado 0 o negativo) nunca inventa un porcentaje: devuelve null', () => {
    expect(compliancePct(0, 0)).toBeNull()
    expect(compliancePct(0, 50)).toBeNull()
    expect(compliancePct(-5, 10)).toBeNull()
  })

  it('programado > 0 y real 0 es un 0% legítimo, no "sin datos"', () => {
    expect(compliancePct(100, 0)).toBe(0)
  })
})
