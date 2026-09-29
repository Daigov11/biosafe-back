import { Prisma } from '../../generated/prisma/index.js'
import { prisma } from './prisma.js'

type SequentialModel = 'quote' | 'order' | 'productionOrder'

const prefixes: Record<SequentialModel, string> = {
  quote: 'COT',
  order: 'PED',
  productionOrder: 'OP',
}

/**
 * Genera un código secuencial (COT-0001, PED-0001, OP-0001) a partir del
 * mayor sufijo numérico ya usado con ese prefijo — no de `count()`, que es
 * frágil ante huecos (filas borradas, códigos no secuenciales como
 * "PED-3CBIO01-179" creados a mano): con `count()`, borrar una fila del
 * medio o tener códigos no numéricos puede hacer que el "siguiente"
 * calculado ya exista. Aun así, esto es SOLO la mejor estimación inicial:
 * la protección real contra colisiones (incluidas condiciones de carrera)
 * vive en `createWithUniqueCode`.
 *
 * `offset` (usado por los reintentos de `createWithUniqueCode`) desplaza
 * el candidato más allá del máximo detectado. Es necesario porque un
 * intento de `create` que falla por choque de unicidad NUNCA llega a
 * persistirse — así que sin `offset`, volver a llamar esta función tras un
 * fallo devolvería exactamente el mismo código ya ocupado, una y otra vez,
 * en vez de avanzar al siguiente candidato.
 */
export async function nextSequentialCode(
  model: SequentialModel,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
  offset = 0,
): Promise<string> {
  const prefix = prefixes[model]
  const rows = await (
    tx[model] as { findMany: (args: unknown) => Promise<{ code: string }[]> }
  ).findMany({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
  })

  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  let max = 0
  for (const row of rows) {
    const match = pattern.exec(row.code)
    if (match) {
      const num = Number(match[1])
      if (num > max) max = num
    }
  }

  return `${prefix}-${String(max + 1 + offset).padStart(4, '0')}`
}

/**
 * Genera un código de lote con un formato similar al usado en planta
 * (p.ej. I-2110185EK): letra de tipo + fecha compacta + secuencia + sufijo
 * alfabético aleatorio. Es solo una convención razonable para la demo; el
 * llamador puede sobreescribirla enviando un lotCode explícito (que pasa
 * por la misma protección de `createWithUniqueCode`).
 */
export function generateLotCode(typeLetter: string, sequence: number): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const seq = String(sequence).padStart(3, '0')
  const suffix = randomLetters(2)
  return `${typeLetter}-${yy}${mm}${dd}${seq}${suffix}`
}

function randomLetters(length: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += letters[Math.floor(Math.random() * letters.length)]
  }
  return result
}

// ---------------------------------------------------------------------------
// Protección contra colisiones de código en flujos de creación
// (Cotización → Pedido → Lote → Orden de Producción).
//
// INVARIANTE: una colisión de código jamás puede mutar una entidad
// existente. Ningún flujo de creación debe usar `upsert` por código — solo
// `create`. Ante un choque de la restricción única del código:
//   - Si el código fue generado automáticamente por el sistema, se
//     regenera y se reintenta (hasta MAX_CODE_GENERATION_ATTEMPTS veces).
//   - Si el código fue ingresado por el usuario, se rechaza de inmediato
//     con `CodeConflictError` (el controller la traduce a HTTP 409) — sin
//     reintentar ni tocar el registro existente.
// ---------------------------------------------------------------------------

export class CodeConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CodeConflictError'
  }
}

const MAX_CODE_GENERATION_ATTEMPTS = 5

function isUniqueFieldConflict(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2002') return false
  const target = (error.meta as { target?: unknown })?.target
  if (Array.isArray(target)) return target.includes(field)
  // Algunos motores devuelven el nombre del índice como string en vez de
  // un array de columnas (p.ej. "quotes_code_key"); se hace un match laxo
  // por si acaso, para no dejar pasar un P2002 real sin detectarlo.
  return typeof target === 'string' && target.toLowerCase().includes(field.toLowerCase())
}

/**
 * Crea una entidad protegida contra colisiones de código único. Nunca hace
 * upsert: siempre intenta un `create` y decide qué hacer solo si ese
 * `create` falla por la restricción única de `uniqueField`.
 *
 * - `userProvidedCode` presente → un choque se rechaza de inmediato con
 *   `CodeConflictError` (HTTP 409 en el controller). No se reintenta ni se
 *   modifica el registro existente.
 * - `userProvidedCode` ausente → el código se genera con
 *   `generateCode(attempt)`; un choque se resuelve incrementando `attempt`
 *   y reintentando, hasta `MAX_CODE_GENERATION_ATTEMPTS` veces. `attempt`
 *   (0, 1, 2…) se pasa al generador para que pueda producir un candidato
 *   distinto en cada intento (p.ej. `nextSequentialCode(model, tx,
 *   attempt)`) — un `create` fallido nunca se persiste, así que llamar de
 *   nuevo a un generador que ignore `attempt` devolvería el mismo código
 *   ya ocupado indefinidamente. Como red de seguridad adicional, si el
 *   generador igual repite un código ya probado en este mismo intento, se
 *   sigue incrementando `attempt` internamente sin gastar un intento
 *   "real" contra la base de datos.
 *
 * Debe llamarse dentro de una transacción MySQL (`prisma.$transaction`):
 * un P2002 en un `INSERT` no invalida el resto de la transacción en
 * MySQL/InnoDB, así que reintentar con un nuevo `create` en la misma `tx`
 * es seguro y mantiene la operación completa atómica (si se agotan los
 * intentos, se lanza y el `$transaction` hace rollback de todo — nunca
 * quedan lote/OP parciales).
 */
export async function createWithUniqueCode<T>(params: {
  uniqueField: string
  userProvidedCode?: string
  generateCode: (attempt: number) => Promise<string> | string
  create: (code: string) => Promise<T>
  conflictMessage: (code: string) => string
}): Promise<T> {
  const { uniqueField, userProvidedCode, generateCode, create, conflictMessage } = params

  if (userProvidedCode) {
    try {
      return await create(userProvidedCode)
    } catch (error) {
      if (isUniqueFieldConflict(error, uniqueField)) {
        throw new CodeConflictError(conflictMessage(userProvidedCode))
      }
      throw error
    }
  }

  const triedCodes = new Set<string>()
  let lastCode = ''
  let attempt = 0

  for (let realAttempts = 0; realAttempts < MAX_CODE_GENERATION_ATTEMPTS; realAttempts++) {
    // Salta candidatos ya probados en este mismo llamado sin consumir un
    // intento real (defensa extra si `generateCode` ignora `attempt`).
    let candidate = await generateCode(attempt)
    let guard = 0
    while (triedCodes.has(candidate) && guard < MAX_CODE_GENERATION_ATTEMPTS) {
      attempt += 1
      candidate = await generateCode(attempt)
      guard += 1
    }

    lastCode = candidate
    triedCodes.add(candidate)
    attempt += 1

    try {
      return await create(candidate)
    } catch (error) {
      if (isUniqueFieldConflict(error, uniqueField)) {
        continue
      }
      throw error
    }
  }

  throw new CodeConflictError(
    `No se pudo generar un código único ("${lastCode}") después de ` +
      `${MAX_CODE_GENERATION_ATTEMPTS} intentos. Intenta nuevamente.`,
  )
}
