import { z } from 'zod'

export const bomComponentTypeSchema = z.enum(['RAW_MATERIAL', 'PRODUCT'])
export const bomComponentClassSchema = z.enum(['PRODUCTIVE_MATERIAL', 'PACKAGING_MATERIAL'])

export const bomItemInputSchema = z
  .object({
    componentType: bomComponentTypeSchema,
    componentClass: bomComponentClassSchema.optional().default('PRODUCTIVE_MATERIAL'),
    rawMaterialId: z.number().int().positive().optional(),
    componentProductId: z.number().int().positive().optional(),
    quantity: z.number().positive('La cantidad debe ser mayor a 0'),
    unit: z.string().trim().min(1, 'La unidad es obligatoria').max(20),
    wastePercentage: z.number().min(0).max(100).optional(),
    requiredWidth: z.number().min(0).optional(),
    requiredLength: z.number().min(0).optional(),
    notes: z.string().trim().max(500).optional(),
    sequence: z.number().int().min(0).optional().default(0),
    required: z.boolean().optional().default(true),
    // "13 piezas comerciales" (PD GLOBAL): si este ítem cuenta como pieza
    // comercial del kit. Editable, no se infiere de componentType — un
    // indicador químico (RAW_MATERIAL) puede ser true; un envoltorio
    // (RAW_MATERIAL) normalmente es false.
    countsTowardKitPieces: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.componentType === 'RAW_MATERIAL') {
      if (!data.rawMaterialId) {
        ctx.addIssue({
          code: 'custom',
          message: 'rawMaterialId es obligatorio cuando componentType es RAW_MATERIAL',
          path: ['rawMaterialId'],
        })
      }
      if (data.componentProductId) {
        ctx.addIssue({
          code: 'custom',
          message: 'No debe enviarse componentProductId cuando componentType es RAW_MATERIAL',
          path: ['componentProductId'],
        })
      }
    } else {
      if (!data.componentProductId) {
        ctx.addIssue({
          code: 'custom',
          message: 'componentProductId es obligatorio cuando componentType es PRODUCT',
          path: ['componentProductId'],
        })
      }
      if (data.rawMaterialId) {
        ctx.addIssue({
          code: 'custom',
          message: 'No debe enviarse rawMaterialId cuando componentType es PRODUCT',
          path: ['rawMaterialId'],
        })
      }
    }
  })

export const saveBomSchema = z.object({
  active: z.boolean().optional().default(true),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(bomItemInputSchema).min(1, 'La composición debe incluir al menos un componente'),
})

export const explosionQuerySchema = z.object({
  quantity: z.coerce.number().positive('quantity debe ser mayor a 0'),
})

export type BomItemInput = z.infer<typeof bomItemInputSchema>
export type SaveBomInput = z.infer<typeof saveBomSchema>
