import { z } from 'zod'

export const createPlantCapacitySchema = z.object({
  code: z.string().trim().min(1, 'El código es obligatorio'),
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  dailyCapacity: z.number().positive('La capacidad diaria debe ser mayor a 0'),
  unit: z.string().trim().min(1, 'La unidad es obligatoria'),
  productId: z.number().int().positive().optional(),
  productFamilyId: z.number().int().positive().optional(),
  active: z.boolean().optional().default(true),
})

export const updatePlantCapacitySchema = createPlantCapacitySchema.partial()

export const generateSchedulesSchema = z.object({
  lotIds: z.array(z.number().int().positive()).min(1, 'Selecciona al menos un lote'),
})

export const updatePlantScheduleSchema = z.object({
  priority: z.number().int().optional(),
  plannedDate: z.coerce.date().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  offeredEndDate: z.coerce.date().nullable().optional(),
  comments: z.string().trim().max(1000).nullable().optional(),
  schedulingNotes: z.string().trim().max(1000).nullable().optional(),
})

export const reorderSchedulesSchema = z.object({
  order: z
    .array(z.object({ id: z.number().int().positive(), priority: z.number().int() }))
    .min(1, 'Nada que reordenar'),
})

/**
 * Filtro de fecha de Programación de Planta (vista y exportación Excel):
 * `dateFrom`/`dateTo` acotan por la fecha programada EFECTIVA de cada
 * lote (`plannedDate`, o en su defecto `startDate`) — nunca por una fecha
 * inventada. Mismo patrón que el resto de reportes con rango de fechas.
 */
export const plantViewQuerySchema = z
  .object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
      ctx.addIssue({
        code: 'custom',
        message: 'La fecha "desde" no puede ser posterior a la fecha "hasta"',
        path: ['dateFrom'],
      })
    }
  })

export type CreatePlantCapacityInput = z.infer<typeof createPlantCapacitySchema>
export type UpdatePlantCapacityInput = z.infer<typeof updatePlantCapacitySchema>
export type GenerateSchedulesInput = z.infer<typeof generateSchedulesSchema>
export type UpdatePlantScheduleInput = z.infer<typeof updatePlantScheduleSchema>
export type ReorderSchedulesInput = z.infer<typeof reorderSchedulesSchema>
export type PlantViewQuery = z.infer<typeof plantViewQuerySchema>
