import { describe, expect, it } from 'vitest'
import { businessDateRangeFilter } from '../src/lib/business-date-range.js'

/**
 * Pruebas puras (sin base de datos) del rango de fechas de negocio
 * (America/Lima, UTC-5 fijo). Cubren el bug corregido: `dateTo` ya no
 * puede excluir registros creados en la tarde/noche del día seleccionado.
 */

describe('businessDateRangeFilter (America/Lima)', () => {
  it('dateFrom: usa gte a las 00:00 Lima (05:00 UTC) del día seleccionado', () => {
    const range = businessDateRangeFilter(new Date('2026-09-24T00:00:00.000Z'), undefined)
    expect(range.gte?.toISOString()).toBe('2026-09-24T05:00:00.000Z')
    expect(range.lt).toBeUndefined()
  })

  it('dateTo: usa lt (exclusivo) a las 00:00 Lima del día SIGUIENTE, nunca lte', () => {
    const range = businessDateRangeFilter(undefined, new Date('2026-09-24T00:00:00.000Z'))
    expect(range.lt?.toISOString()).toBe('2026-09-25T05:00:00.000Z')
    expect(range).not.toHaveProperty('lte')
  })

  it('un mismo día (Desde = Hasta = 24/09) incluye mañana, tarde y noche completas de ese día en Lima', () => {
    const range = businessDateRangeFilter(new Date('2026-09-24T00:00:00.000Z'), new Date('2026-09-24T00:00:00.000Z'))

    const morningLima = new Date('2026-09-24T13:00:00.000Z') // 08:00 Lima
    const afternoonLima = new Date('2026-09-24T22:00:00.000Z') // 17:00 Lima
    const nightLima = new Date('2026-09-25T04:59:00.000Z') // 23:59 Lima del 24/09

    for (const instant of [morningLima, afternoonLima, nightLima]) {
      expect(instant.getTime()).toBeGreaterThanOrEqual(range.gte!.getTime())
      expect(instant.getTime()).toBeLessThan(range.lt!.getTime())
    }

    // El bug original (lte con medianoche UTC) excluía exactamente estos
    // registros de tarde/noche: verificamos que ya no ocurre.
    expect(afternoonLima.getTime()).toBeGreaterThan(new Date('2026-09-24T00:00:00.000Z').getTime())
  })

  it('un instante del día siguiente (00:01 Lima del 25/09) queda fuera del rango del 24/09', () => {
    const range = businessDateRangeFilter(new Date('2026-09-24T00:00:00.000Z'), new Date('2026-09-24T00:00:00.000Z'))
    const nextDayLima = new Date('2026-09-25T05:01:00.000Z') // 00:01 Lima del 25/09
    expect(nextDayLima.getTime()).toBeGreaterThanOrEqual(range.lt!.getTime())
  })

  it('rango de varios días incluye el último día completo (Hasta) hasta las 23:59 Lima', () => {
    const range = businessDateRangeFilter(new Date('2026-09-20T00:00:00.000Z'), new Date('2026-09-24T00:00:00.000Z'))
    expect(range.gte?.toISOString()).toBe('2026-09-20T05:00:00.000Z')
    expect(range.lt?.toISOString()).toBe('2026-09-25T05:00:00.000Z')

    const lastDayNightLima = new Date('2026-09-25T04:30:00.000Z') // 23:30 Lima del 24/09
    expect(lastDayNightLima.getTime()).toBeGreaterThanOrEqual(range.gte!.getTime())
    expect(lastDayNightLima.getTime()).toBeLessThan(range.lt!.getTime())
  })

  it('respeta el desborde de mes/año al calcular el día siguiente (30/09 → 01/10)', () => {
    const range = businessDateRangeFilter(undefined, new Date('2026-09-30T00:00:00.000Z'))
    expect(range.lt?.toISOString()).toBe('2026-10-01T05:00:00.000Z')
  })

  it('sin dateFrom ni dateTo, no arma ningún filtro', () => {
    const range = businessDateRangeFilter(undefined, undefined)
    expect(range).toEqual({})
  })
})
