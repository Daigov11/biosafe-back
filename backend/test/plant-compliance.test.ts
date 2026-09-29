import { describe, expect, it } from 'vitest'
import { complianceStateLabel, computeCompliance, dayKey } from '../src/modules/planning/plant-compliance.js'

/**
 * Pruebas puras (sin base de datos) del cumplimiento Programado vs. Real
 * por FECHA PROGRAMADA — Programación de Planta. Cubre los 4 casos que
 * pide la mejora obligatoria (parcial, cumplido, sobreproducción, sin
 * fecha), incluyendo el caso "cumplido" que no se puede reproducir con
 * los datos demo actuales (ver informe final).
 */

describe('dayKey', () => {
  it('formatea el día UTC tal cual, sin desplazar horas', () => {
    expect(dayKey(new Date('2026-09-23T00:00:00.000Z'))).toBe('2026-09-23')
    expect(dayKey(new Date('2026-09-23T23:59:59.000Z'))).toBe('2026-09-23')
  })
})

describe('computeCompliance', () => {
  it('avance parcial: DIFERENCIA positiva (falta producir), % P/R a un decimal', () => {
    // Caso real del demo: I-2110185EK, Programado 250, Real 150 (23/09).
    expect(computeCompliance(250, 150)).toEqual({ diferencia: 100, pctPR: 60 })
  })

  it('lote cumplido: Real = Programado da DIFERENCIA cero y 100.0%', () => {
    expect(computeCompliance(200, 200)).toEqual({ diferencia: 0, pctPR: 100 })
  })

  it('sobreproducción: Real > Programado da DIFERENCIA negativa', () => {
    expect(computeCompliance(100, 130)).toEqual({ diferencia: -30, pctPR: 130 })
  })

  it('sin avance registrado ese día: Real 0 es legítimo (0.0%), no "sin datos"', () => {
    expect(computeCompliance(2151, 0)).toEqual({ diferencia: 2151, pctPR: 0 })
  })

  it('% P/R a un decimal (no se redondea a entero)', () => {
    expect(computeCompliance(3, 1)).toEqual({ diferencia: 2, pctPR: 33.3 })
  })

  it('sin Real (sin fecha programada o sin OP): nunca inventa, todo null', () => {
    expect(computeCompliance(250, null)).toEqual({ diferencia: null, pctPR: null })
  })

  it('PROGRAMADO 0 con Real conocido: % P/R null (no se puede dividir por 0), DIFERENCIA sí se calcula', () => {
    expect(computeCompliance(0, 5)).toEqual({ diferencia: -5, pctPR: null })
  })
})

describe('complianceStateLabel', () => {
  it('nunca depende solo del color: siempre hay una etiqueta de texto', () => {
    expect(complianceStateLabel(100)).toBe('Pendiente')
    expect(complianceStateLabel(0)).toBe('Cumplido')
    expect(complianceStateLabel(-30)).toBe('Sobreproducción')
    expect(complianceStateLabel(null)).toBe('Sin programación')
  })
})
