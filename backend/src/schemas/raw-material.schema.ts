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

export const rawMaterialBaseSchema = z.object({
  code: z.string().trim().min(1, 'El código es obligatorio').max(40),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: optionalTrimmedString,
  type: optionalTrimmedString,

  familyId: optionalId,
  categoryId: optionalId,

  grammage: optionalPositiveNumber,
  grammageUnit: optionalTrimmedString,
  width: optionalPositiveNumber,
  widthUnit: optionalTrimmedString,
  length: optionalPositiveNumber,
  lengthUnit: optionalTrimmedString,

  color: optionalTrimmedString,
  size: optionalTrimmedString,
  presentation: optionalTrimmedString,

  netWeightPerRollKg: optionalPositiveNumber,

  purchaseUnitId: optionalId,
  inventoryUnitId: optionalId,
  consumptionUnitId: optionalId,

  controlByLot: z.boolean().optional().default(false),
  controlByUnit: z.boolean().optional().default(false),
  controlByDimensions: z.boolean().optional().default(false),
  allowsReusableBalance: z.boolean().optional().default(false),

  referenceStock: optionalPositiveNumber,

  active: z.boolean().optional().default(true),
})

export const createRawMaterialSchema = rawMaterialBaseSchema

export const updateRawMaterialSchema = rawMaterialBaseSchema.partial().extend({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(200).optional(),
})

export const listRawMaterialsQuerySchema = z.object({
  search: z.string().trim().optional(),
  familyId: z.coerce.number().int().optional(),
  categoryId: z.coerce.number().int().optional(),
  type: z.string().trim().optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export type CreateRawMaterialInput = z.infer<typeof createRawMaterialSchema>
export type UpdateRawMaterialInput = z.infer<typeof updateRawMaterialSchema>
export type ListRawMaterialsQuery = z.infer<typeof listRawMaterialsQuerySchema>
