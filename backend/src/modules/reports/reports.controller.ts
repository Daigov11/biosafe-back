import type { Request, Response } from 'express'
import { z } from 'zod'
import { buildOrderStatusReport } from './order-status.service.js'
import type { OrderStatusFilters } from './order-status.service.js'
import { buildOrderStatusWorkbook, buildPlantProgrammingWorkbook } from './excel-export.service.js'
import { getPlantView } from '../planning/planning.service.js'
import { plantViewQuerySchema } from '../../schemas/planning.schema.js'
import { buildDashboard } from './dashboard.service.js'

const lotIdsTransform = z
  .union([z.string(), z.array(z.union([z.string(), z.number()]))])
  .optional()
  .transform((value) => {
    if (!value) return undefined
    const raw = Array.isArray(value) ? value : value.split(',')
    const ids = raw.map((v) => Number(String(v).trim())).filter((n) => Number.isInteger(n) && n > 0)
    return ids.length > 0 ? ids : undefined
  })

const orderStatusQuerySchema = z
  .object({
    lotIds: lotIdsTransform,
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    dateField: z.enum(['fCreac', 'fReq', 'fReal']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
      ctx.addIssue({
        code: 'custom',
        message: 'La fecha "desde" no puede ser posterior a la fecha "hasta"',
        path: ['dateFrom'],
      })
    }
  })

function todayStamp() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

const dateFieldLabels: Record<NonNullable<OrderStatusFilters['dateField']>, string> = {
  fCreac: 'Fecha de creación',
  fReq: 'Fecha requerida',
  fReal: 'Fecha real de producción',
}

function formatFilterDate(value: Date) {
  return value.toLocaleDateString('es-PE', { timeZone: 'UTC' })
}

function buildAppliedFiltersLabel(filters: OrderStatusFilters) {
  const parts: string[] = []
  if (filters.dateFrom || filters.dateTo) {
    const field = dateFieldLabels[filters.dateField ?? 'fCreac']
    const from = filters.dateFrom ? formatFilterDate(filters.dateFrom) : '—'
    const to = filters.dateTo ? formatFilterDate(filters.dateTo) : '—'
    parts.push(`${field}: ${from} a ${to}`)
  }
  if (filters.lotIds && filters.lotIds.length > 0) {
    parts.push(`${filters.lotIds.length} lote(s) seleccionado(s)`)
  } else {
    parts.push('Todos los lotes')
  }
  return parts.join(' · ')
}

export async function getOrderStatus(req: Request, res: Response) {
  const filters = orderStatusQuerySchema.parse(req.query)
  const rows = await buildOrderStatusReport(filters)
  res.json(rows)
}

export async function exportOrderStatus(req: Request, res: Response) {
  const filters = orderStatusQuerySchema.parse(req.body ?? {})
  const rows = await buildOrderStatusReport(filters)
  const workbook = await buildOrderStatusWorkbook(rows, buildAppliedFiltersLabel(filters))

  const filename = `SITUACION_PEDIDOS_${todayStamp()}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(res)
  res.end()
}

const dashboardQuerySchema = z
  .object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    customerId: z.coerce.number().int().positive().optional(),
    familyId: z.coerce.number().int().positive().optional(),
    routeId: z.coerce.number().int().positive().optional(),
    status: z.enum(['PENDING_REVIEW', 'REVIEWED', 'APPROVED', 'CANCELLED']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
      ctx.addIssue({
        code: 'custom',
        message: 'La fecha "desde" no puede ser posterior a la fecha "hasta"',
        path: ['dateFrom'],
      })
    }
  })

export async function getDashboard(req: Request, res: Response) {
  const filters = dashboardQuerySchema.parse(req.query)
  const dashboard = await buildDashboard(filters)
  res.json(dashboard)
}

export async function exportPlantProgramming(req: Request, res: Response) {
  const filters = plantViewQuerySchema.parse(req.body ?? {})
  const rows = await getPlantView(filters)
  const workbook = await buildPlantProgrammingWorkbook(rows)

  const filename = `PROGRAMACION_PLANTA_BIOSAFE_${todayStamp()}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(res)
  res.end()
}
