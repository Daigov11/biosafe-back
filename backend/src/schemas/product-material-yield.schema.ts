import { z } from 'zod'

// `productSize` NO se recibe del cliente: siempre se deriva de
// `Product.size` en el servicio, para que nunca pueda divergir del
// producto al que pertenece el rendimiento.
export const createProductMaterialYieldSchema = z.object({
  rawMaterialId: z.number().int().positive('Selecciona una materia prima'),
  cutWidth: z.number().positive().optional(),
  cutLength: z.number().positive().optional(),
  unitsPerRoll: z.number().int().positive('Las unidades por rollo deben ser mayores a 0'),
  sourceRollWidth: z.number().positive().optional(),
  sourceRollLength: z.number().positive().optional(),
  sourceGrammage: z.number().positive().optional(),
  effectiveFrom: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  active: z.boolean().optional().default(true),
})

export const updateProductMaterialYieldSchema = createProductMaterialYieldSchema.partial()

export type CreateProductMaterialYieldInput = z.infer<typeof createProductMaterialYieldSchema>
export type UpdateProductMaterialYieldInput = z.infer<typeof updateProductMaterialYieldSchema>
