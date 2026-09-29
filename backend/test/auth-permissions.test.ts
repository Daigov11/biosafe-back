import { describe, expect, it } from 'vitest'
import {
  assertPasswordPolicy,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from '../src/lib/auth/password.js'
import { can, type Permission, type Role } from '../src/lib/auth/permissions.js'
import { assertYieldOverrideIsJustified, suggestUnitsPerRoll, YieldValidationError } from '../src/lib/costing/yield.js'

describe('contraseñas y sesiones', () => {
  it('hash con sal: mismo texto → hashes distintos, ambos verifican', () => {
    const a = hashPassword('una-clave-larga-1')
    const b = hashPassword('una-clave-larga-1')
    expect(a).not.toBe(b)
    expect(verifyPassword('una-clave-larga-1', a)).toBe(true)
    expect(verifyPassword('otra-clave-larga', a)).toBe(false)
    expect(a).not.toContain('una-clave-larga-1')
  })
  it('formato inválido o manipulado no verifica', () => {
    expect(verifyPassword('x', 'texto-plano')).toBe(false)
    expect(verifyPassword('x', 'scrypt$16384$$')).toBe(false)
  })
  it('política: mínimo 10 caracteres', () => {
    expect(() => assertPasswordPolicy('corta')).toThrow()
    expect(() => assertPasswordPolicy('suficientemente-larga')).not.toThrow()
  })
  it('el token de sesión no se guarda: solo su hash SHA-256', () => {
    const { token, tokenHash } = generateSessionToken()
    expect(tokenHash).toBe(hashSessionToken(token))
    expect(tokenHash).not.toContain(token)
    expect(tokenHash).toHaveLength(64)
    expect(generateSessionToken().token).not.toBe(token)
  })
})

describe('matriz de permisos por rol (D1)', () => {
  const expectations: Record<Role, { yes: Permission[]; no: Permission[] }> = {
    COMERCIAL: {
      yes: ['quote:draft', 'quote:send', 'quote:margin-change', 'price:override-request'],
      no: ['quote:approve', 'price:override-approve', 'costs:manage', 'technical:manage', 'users:manage'],
    },
    COSTOS: {
      yes: ['costs:manage'],
      no: ['quote:send', 'quote:approve', 'technical:manage', 'users:manage'],
    },
    INGENIERIA: {
      yes: ['technical:manage'],
      no: ['costs:manage', 'quote:send', 'quote:approve', 'users:manage'],
    },
    DIRECCION: {
      yes: ['quote:approve', 'price:override-approve'],
      no: ['costs:manage', 'technical:manage', 'users:manage'],
    },
    ADMIN: {
      yes: ['quote:draft', 'quote:send', 'quote:approve', 'price:override-approve', 'costs:manage', 'technical:manage', 'users:manage', 'audit:read'],
      no: [],
    },
  }
  for (const [role, { yes, no }] of Object.entries(expectations) as [Role, (typeof expectations)[Role]][]) {
    it(`${role}`, () => {
      for (const p of yes) expect(can(role, p), `${role} debe poder ${p}`).toBe(true)
      for (const p of no) expect(can(role, p), `${role} NO debe poder ${p}`).toBe(false)
    })
  }
  it('Comercial no puede modificar costos maestros ni ficha técnica', () => {
    expect(can('COMERCIAL', 'costs:manage')).toBe(false)
    expect(can('COMERCIAL', 'technical:manage')).toBe(false)
  })
})

describe('rendimiento: sugerencia vs. valor oficial (D4)', () => {
  it('sugiere unidades por rollo con ancho útil, largo útil y tizado', () => {
    // Sábana 200x150: 1 pieza a lo ancho, avance 1.5 m sobre 2750 m útiles
    expect(suggestUnitsPerRoll({ usableRollWidth: 2.1, usableRollLength: 2750, pieceWidth: 2, pieceLength: 1.5 })).toBe(1833)
  })
  it('acepta tizado explícito (piezas a lo ancho y avance)', () => {
    expect(suggestUnitsPerRoll({ usableRollWidth: 2.1, usableRollLength: 2750, pieceWidth: 0.9, pieceLength: 0.9, piecesAcross: 2, lengthStep: 0.75 })).toBe(7332)
  })
  it('rechaza medidas no positivas', () => {
    expect(() => suggestUnitsPerRoll({ usableRollWidth: 0, usableRollLength: 1, pieceWidth: 1, pieceLength: 1 })).toThrow()
  })
  it('un valor distinto de la sugerencia exige motivo', () => {
    expect(() => assertYieldOverrideIsJustified({ officialUnitsPerRoll: 1700, suggestedUnitsPerRoll: 1833, validatedById: 1 })).toThrow(YieldValidationError)
    expect(() => assertYieldOverrideIsJustified({ officialUnitsPerRoll: 1700, suggestedUnitsPerRoll: 1833, reason: 'Merma de bordes medida en planta', validatedById: 1 })).not.toThrow()
  })
  it('igual a la sugerencia no exige motivo, pero siempre exige responsable', () => {
    expect(() => assertYieldOverrideIsJustified({ officialUnitsPerRoll: 1833, suggestedUnitsPerRoll: 1833, validatedById: 1 })).not.toThrow()
    expect(() => assertYieldOverrideIsJustified({ officialUnitsPerRoll: 1833, suggestedUnitsPerRoll: 1833 })).toThrow(YieldValidationError)
  })
  it('el rendimiento debe ser un entero positivo', () => {
    expect(() => assertYieldOverrideIsJustified({ officialUnitsPerRoll: 0, validatedById: 1 })).toThrow()
    expect(() => assertYieldOverrideIsJustified({ officialUnitsPerRoll: 10.5, validatedById: 1 })).toThrow()
  })
})
