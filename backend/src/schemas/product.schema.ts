import { z } from 'zod'

const optionalTrimmedString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined))

const optionalPositiveNumber = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === undefined || value === null || value === '') return undefined
    const num = typeof value === 'string' ? Number(value) : value
    return Number.isFinite(num) ? num : undefined
  })
  .refine((value) => value === undefined || value >= 0, {
    message: 'Debe ser un número mayor o igual a 0',
  })

const optionalId = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === undefined || value === null || value === '') return undefined
    const num = typeof value === 'string' ? Number(value) : value
    return Number.isInteger(num) ? num : undefined
  })

export const productTypeSchema = z.enum(['INDIVIDUAL', 'KIT', 'SEMI_FINISHED'])

export const productBaseSchema = z.object({
  code: z.string().trim().min(1, 'El código es obligatorio').max(40),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: optionalTrimmedString,

  familyId: optionalId,
  categoryId: optionalId,

  productType: productTypeSchema.optional().default('INDIVIDUAL'),

  presentation: optionalTrimmedString,
  width: optionalPositiveNumber,
  length: optionalPositiveNumber,
  grammage: optionalPositiveNumber,
  size: optionalTrimmedString,

  sterile: z.boolean().optional().default(false),
  fenestrated: z.boolean().optional().default(false),
  reinforced: z.boolean().optional().default(false),
  laminated: z.boolean().optional().default(false),
  usesAdhesive: z.boolean().optional().default(false),
  usesLabel: z.boolean().optional().default(false),
  usesBag: z.boolean().optional().default(false),

  routeId: optionalId,

  active: z.boolean().optional().default(true),
})

export const createProductSchema = productBaseSchema

export const updateProductSchema = productBaseSchema.partial().extend({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(200).optional(),
})

export const listProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  familyId: z.coerce.number().int().optional(),
  categoryId: z.coerce.number().int().optional(),
  productType: productTypeSchema.optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>
