import type { Prisma, PrismaClient } from '../../generated/prisma/index.js'
import type { AuthUser } from '../middleware/auth.js'

type Db = PrismaClient | Prisma.TransactionClient

export interface AuditEntry {
  action: string
  entity: string
  entityId?: string | number | null
  field?: string
  oldValue?: unknown
  newValue?: unknown
  reason?: string
}

export class AuditReasonRequiredError extends Error {}

/** Acciones que exigen motivo: costos, aprobaciones, margen y precio excepcional. */
const REASON_REQUIRED = /^(COST_|APPROVE|MARGIN_CHANGE|PRICE_OVERRIDE|YIELD_)/

const toJson = (v: unknown) =>
  v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue)

export async function recordAudit(db: Db, actor: AuthUser, entry: AuditEntry) {
  if (REASON_REQUIRED.test(entry.action) && !entry.reason?.trim()) {
    throw new AuditReasonRequiredError('Indica el motivo del cambio')
  }
  return db.auditLog.create({
    data: {
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
      field: entry.field,
      oldValue: toJson(entry.oldValue),
      newValue: toJson(entry.newValue),
      reason: entry.reason?.trim(),
    },
  })
}
