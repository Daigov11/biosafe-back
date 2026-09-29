import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { recordAudit } from '../../lib/audit.js'
import { can } from '../../lib/auth/permissions.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { assertYieldOverrideIsJustified, YieldValidationError } from '../../lib/costing/yield.js'
import { prisma } from '../../lib/prisma.js'
import { requirePermission } from '../../middleware/auth.js'

// Costos maestros: cada cambio crea una VERSIÓN nueva (vigencia), nunca
// sobrescribe. Las cotizaciones ya emitidas usan su snapshot y no se alteran.
// Ningún esquema acepta `isFixture`: los datos históricos no se crean por API.
export const costsRouter = Router()
const readCosts = (req: Request, res: Response, next: NextFunction) => {
  const role = req.user!.role
  if (can(role, 'costs:manage') || can(role, 'audit:read')) return next()
  res.status(403).json({ status: 'error', message: 'No tienes permiso para ver costos' })
}
const writeCosts = requirePermission('costs:manage')

const reason = z.string().trim().min(3, 'Indica el motivo del cambio')
const effectiveFrom = z.coerce.date().optional()
const money = z.number().min(0)

const parameterSchema = z.object({
  key: z.string().trim().min(1).max(60),
  value: z.number(),
  effectiveFrom,
  notes: z.string().trim().max(500).optional(),
  reason,
})
const serviceSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  category: z.enum(['PEEL_OPEN', 'STICKER', 'PACK_PREPARATION', 'BOX', 'BOX_STICKER', 'STERILIZATION', 'OTHER']),
  price: money,
  includesTax: z.boolean(),
  unitsPerPack: z.number().int().positive().optional(),
  supplier: z.string().trim().max(200).optional(),
  effectiveFrom,
  notes: z.string().trim().max(500).optional(),
  pendingValidation: z.boolean().optional(),
  reason,
})
const materialSchema = z.object({
  rawMaterialId: z.number().int().positive(),
  price: money,
  priceUnit: z.enum(['ROLL', 'METER', 'CENTIMETER', 'UNIT', 'BOX', 'PACK', 'KIT']),
  includesTax: z.boolean(),
  usableLength: z.number().positive().optional(),
  supplier: z.string().trim().max(200).optional(),
  effectiveFrom,
  notes: z.string().trim().max(500).optional(),
  pendingValidation: z.boolean().optional(),
  reason,
})
const laborSchema = z
  .object({
    productId: z.number().int().positive(),
    mode: z.enum(['FIXED_PER_UNIT', 'MINUTES_RATE', 'SUPPLIER']),
    amount: money,
    ratePerMinute: money.optional(),
    supplier: z.string().trim().max(200).optional(),
    quotationEvidence: z.string().trim().max(2000).optional(),
    effectiveFrom,
    notes: z.string().trim().max(500).optional(),
    pendingValidation: z.boolean().optional(),
    reason,
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'MINUTES_RATE' && v.ratePerMinute === undefined) {
      ctx.addIssue({ code: 'custom', path: ['ratePerMinute'], message: 'La tarifa por minuto es obligatoria' })
    }
    if (v.mode === 'SUPPLIER' && (!v.supplier || !v.quotationEvidence)) {
      ctx.addIssue({ code: 'custom', path: ['supplier'], message: 'Proveedor y evidencia de su cotización son obligatorios' })
    }
  })

type Delegate = {
  findFirst: (args: unknown) => Promise<unknown>
  findMany: (args: unknown) => Promise<unknown[]>
  create: (args: { data: Record<string, unknown> }) => Promise<{ id: number }>
}

function versionedResource(
  path: string,
  entity: string,
  schema: z.ZodType<Record<string, unknown> & { reason: string; effectiveFrom?: Date }>,
  delegate: () => Delegate,
  keyOf: (data: Record<string, unknown>) => Record<string, unknown>,
  orderBy: object,
) {
  costsRouter.get(
    path,
    readCosts,
    asyncHandler(async (_req, res) => {
      res.json({ items: await delegate().findMany({ orderBy }) })
    }),
  )
  costsRouter.post(
    path,
    writeCosts,
    asyncHandler(async (req, res) => {
      const { reason: why, ...data } = schema.parse(req.body)
      const created = await prisma.$transaction(async (tx) => {
        const d = (tx as unknown as Record<string, Delegate>)[delegateName(entity)]
        const previous = await d.findFirst({ where: keyOf(data), orderBy: { effectiveFrom: 'desc' } })
        const row = await d.create({
          data: { ...data, effectiveFrom: data.effectiveFrom ?? new Date(), isFixture: false, createdById: req.user!.id },
        })
        await recordAudit(tx, req.user!, {
          action: previous ? 'COST_VERSION' : 'COST_CREATE',
          entity,
          entityId: row.id,
          oldValue: previous ?? null,
          newValue: row,
          reason: why,
        })
        return row
      })
      res.status(201).json(created)
    }),
  )
}

const delegateName = (entity: string) =>
  ({ CostParameter: 'costParameter', ServiceCost: 'serviceCost', MaterialCost: 'materialCost', LaborCost: 'laborCost' })[entity]!

versionedResource('/parameters', 'CostParameter', parameterSchema, () => prisma.costParameter as unknown as Delegate, (d) => ({ key: d.key }), [{ key: 'asc' }, { effectiveFrom: 'desc' }])
versionedResource('/services', 'ServiceCost', serviceSchema, () => prisma.serviceCost as unknown as Delegate, (d) => ({ code: d.code }), [{ code: 'asc' }, { effectiveFrom: 'desc' }])
versionedResource('/materials', 'MaterialCost', materialSchema, () => prisma.materialCost as unknown as Delegate, (d) => ({ rawMaterialId: d.rawMaterialId }), [{ rawMaterialId: 'asc' }, { effectiveFrom: 'desc' }])
versionedResource('/labor', 'LaborCost', laborSchema, () => prisma.laborCost as unknown as Delegate, (d) => ({ productId: d.productId }), [{ productId: 'asc' }, { effectiveFrom: 'desc' }])

// --- Origen del costo del producto (D8: componente de proveedor) ------------
const policySchema = z
  .object({
    costSource: z.enum(['OWN', 'SUPPLIER']),
    supplier: z.string().trim().max(200).optional(),
    supplierUnitCost: money.optional(),
    supplierIncludesTax: z.boolean().optional(),
    supplierValidFrom: z.coerce.date().optional(),
    supplierValidUntil: z.coerce.date().optional(),
    supplierEvidence: z.string().trim().max(2000).optional(),
    suggestedMargin: z.number().min(0).lt(1).optional(),
    unitsPerBox: z.number().int().positive().optional(),
    unitsPerBag: z.number().int().positive().optional(),
    reason,
  })
  .superRefine((v, ctx) => {
    if (v.costSource !== 'SUPPLIER') return
    const need: [string, unknown][] = [
      ['supplier', v.supplier],
      ['supplierUnitCost', v.supplierUnitCost],
      ['supplierIncludesTax', v.supplierIncludesTax],
      ['supplierValidFrom', v.supplierValidFrom],
      ['supplierValidUntil', v.supplierValidUntil],
      ['supplierEvidence', v.supplierEvidence],
    ]
    for (const [path, value] of need) {
      if (value === undefined || value === '') ctx.addIssue({ code: 'custom', path: [path], message: 'Obligatorio para un componente de proveedor' })
    }
  })

costsRouter.put(
  '/products/:productId/policy',
  writeCosts,
  asyncHandler(async (req, res) => {
    const productId = z.coerce.number().int().positive().parse(req.params.productId)
    const { reason: why, ...data } = policySchema.parse(req.body)
    if (!(await prisma.product.findUnique({ where: { id: productId } }))) {
      res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
      return
    }
    const saved = await prisma.$transaction(async (tx) => {
      const previous = await tx.productCostPolicy.findUnique({ where: { productId } })
      const row = await tx.productCostPolicy.upsert({
        where: { productId },
        create: { productId, ...data, updatedById: req.user!.id },
        update: { ...data, updatedById: req.user!.id },
      })
      await recordAudit(tx, req.user!, { action: 'COST_POLICY_CHANGE', entity: 'ProductCostPolicy', entityId: productId, oldValue: previous, newValue: row, reason: why })
      return row
    })
    res.json(saved)
  }),
)

// --- Rendimiento: valor oficial validado por Ingeniería (D4) ----------------
const yieldSchema = z.object({
  unitsPerRoll: z.number().int().positive(),
  usableRollWidth: z.number().positive().optional(),
  usableRollLength: z.number().positive().optional(),
  suggestedUnitsPerRoll: z.number().int().positive().optional(),
  nestingNote: z.string().trim().max(190).optional(),
  reason: z.string().trim().optional(),
})

costsRouter.post(
  '/yields/:id/validate',
  requirePermission('technical:manage'),
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const body = yieldSchema.parse(req.body)
    const before = await prisma.productMaterialYield.findUnique({ where: { id } })
    if (!before) {
      res.status(404).json({ status: 'error', message: 'Rendimiento no encontrado' })
      return
    }
    const suggested = body.suggestedUnitsPerRoll ?? before.suggestedUnitsPerRoll
    try {
      assertYieldOverrideIsJustified({
        officialUnitsPerRoll: body.unitsPerRoll,
        suggestedUnitsPerRoll: suggested,
        reason: body.reason,
        validatedById: req.user!.id,
      })
    } catch (error) {
      if (error instanceof YieldValidationError) {
        res.status(400).json({ status: 'error', message: error.message })
        return
      }
      throw error
    }
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.productMaterialYield.update({
        where: { id },
        data: {
          unitsPerRoll: body.unitsPerRoll,
          usableRollWidth: body.usableRollWidth,
          usableRollLength: body.usableRollLength,
          suggestedUnitsPerRoll: suggested ?? undefined,
          nestingNote: body.nestingNote,
          overrideReason: body.reason?.trim() || null,
          validationStatus: 'VALIDATED',
          validatedById: req.user!.id,
          validatedAt: new Date(),
        },
      })
      await recordAudit(tx, req.user!, {
        action: 'YIELD_VALIDATE',
        entity: 'ProductMaterialYield',
        entityId: id,
        field: 'unitsPerRoll',
        oldValue: { unitsPerRoll: before.unitsPerRoll, validationStatus: before.validationStatus },
        newValue: { unitsPerRoll: row.unitsPerRoll, validationStatus: row.validationStatus },
        reason: body.reason?.trim() || 'Validación de rendimiento por Ingeniería',
      })
      return row
    })
    res.json(updated)
  }),
)

// --- Consulta de auditoría --------------------------------------------------
costsRouter.get(
  '/audit',
  requirePermission('audit:read'),
  asyncHandler(async (req, res) => {
    const q = z
      .object({ entity: z.string().optional(), entityId: z.string().optional(), take: z.coerce.number().int().min(1).max(500).default(100) })
      .parse(req.query)
    res.json({
      items: await prisma.auditLog.findMany({
        where: { entity: q.entity, entityId: q.entityId },
        orderBy: { createdAt: 'desc' },
        take: q.take,
      }),
    })
  }),
)

