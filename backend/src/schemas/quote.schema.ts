import { z } from 'zod'

export const quoteItemInputSchema = z.object({
  productId: z.number().int().positive('Selecciona un producto'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  // Snapshot comercial de ESTA cotización — nunca se copia al maestro de
  // Producto ni de Materia Prima. Todos opcionales: una cotización puede
  // no tener aún precio definido.
  unitCostWithTax: z.number().min(0).optional(),
  unitCostWithoutTax: z.number().min(0).optional(),
  marginPercentage: z.number().min(0).max(100).optional(),
  unitPriceWithTax: z.number().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
  sequence: z.number().int().min(0).optional().default(0),
})

export const createQuoteSchema = z.object({
  customerId: z.number().int().positive('Selecciona un cliente'),
  quoteDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(quoteItemInputSchema).min(1, 'La cotización debe incluir al menos un ítem'),
})

export const updateQuoteSchema = z.object({
  customerId: z.number().int().positive().optional(),
  quoteDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(quoteItemInputSchema).min(1).optional(),
})

export const listQuotesQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED']).optional(),
  customerId: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>
export type ListQuotesQuery = z.infer<typeof listQuotesQuerySchema>
