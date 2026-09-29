import { z } from 'zod'

export const customerBaseSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  taxId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  active: z.boolean().optional().default(true),
})

export const createCustomerSchema = customerBaseSchema
export const updateCustomerSchema = customerBaseSchema.partial()

export const listCustomersQuerySchema = z.object({
  search: z.string().trim().optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>
