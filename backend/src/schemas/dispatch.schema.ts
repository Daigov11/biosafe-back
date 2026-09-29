import { z } from 'zod'

export const createDispatchSchema = z.object({
  lotId: z.number().int().positive(),
  date: z.coerce.date().optional(),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  guideNumber: z.string().trim().min(1, 'Indica el número de guía'),
  notes: z.string().trim().max(500).optional(),
})

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>
