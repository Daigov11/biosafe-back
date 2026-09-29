import { z } from 'zod'

export const createProductionProgressSchema = z.object({
  productionOrderId: z.number().int().positive(),
  routeStepId: z.number().int().positive(),
  date: z.coerce.date().optional(),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  notes: z.string().trim().max(500).optional(),
})

export const updateProductionProgressSchema = z.object({
  routeStepId: z.number().int().positive().optional(),
  date: z.coerce.date().optional(),
  quantity: z.number().positive('La cantidad debe ser mayor a 0').optional(),
  notes: z.string().trim().max(500).optional(),
})

export const listProductionProgressQuerySchema = z.object({
  productionOrderId: z.coerce.number().int().positive().optional(),
  lotId: z.coerce.number().int().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  productionOrderStatus: z
    .enum(['DRAFT', 'RELEASED', 'IN_PRODUCTION', 'IN_QUALITY', 'COMPLETED', 'CANCELLED'])
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export type CreateProductionProgressInput = z.infer<typeof createProductionProgressSchema>
export type UpdateProductionProgressInput = z.infer<typeof updateProductionProgressSchema>
export type ListProductionProgressQuery = z.infer<typeof listProductionProgressQuerySchema>
