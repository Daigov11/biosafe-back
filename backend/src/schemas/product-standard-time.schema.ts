import { z } from 'zod'

export const createProductStandardTimeSchema = z.object({
  routeStepId: z.number().int().positive(),
  standardTimeMinutes: z.number().positive('El tiempo estándar debe ser mayor a 0'),
  people: z.number().int().positive().nullable().optional(),
  effectiveFrom: z.coerce.date().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

export const updateProductStandardTimeSchema = createProductStandardTimeSchema.partial()

export type CreateProductStandardTimeInput = z.infer<typeof createProductStandardTimeSchema>
export type UpdateProductStandardTimeInput = z.infer<typeof updateProductStandardTimeSchema>
