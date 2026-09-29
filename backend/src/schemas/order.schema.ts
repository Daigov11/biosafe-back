import { z } from 'zod'

export const listOrdersQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['PENDING_REVIEW', 'REVIEWED', 'APPROVED', 'CANCELLED']).optional(),
  customerId: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export const updateOrderSchema = z.object({
  purchaseOrderNumber: z.string().trim().max(120).nullable().optional(),
})

export const generateProductionOrderSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.number().int().positive(),
        lotCode: z
          .string()
          .trim()
          .min(1)
          .optional()
          .or(z.literal('').transform(() => undefined)),
      }),
    )
    .optional(),
})

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
export type GenerateProductionOrderInput = z.infer<typeof generateProductionOrderSchema>
