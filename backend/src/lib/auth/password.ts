import crypto from 'node:crypto'

// scrypt (nativo de Node): sin dependencias nuevas. Formato: scrypt$N$salt$hash
const KEY_LENGTH = 64
const COST = 16384
export const MIN_PASSWORD_LENGTH = 10

export function assertPasswordPolicy(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, { N: COST })
  return `scrypt$${COST}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, cost, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !cost || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(cost),
  })
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

export function generateSessionToken() {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, tokenHash: hashSessionToken(token) }
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
