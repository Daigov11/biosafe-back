import { z } from 'zod'

const optionalTrimmedString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined))

export const routeBaseSchema = z.object({
  code: z.string().trim().min(1, 'El código es obligatorio').max(20),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: optionalTrimmedString,
  active: z.boolean().optional().default(true),
})

export const createRouteSchema = routeBaseSchema

export const updateRouteSchema = routeBaseSchema.partial().extend({
  code: z.string().trim().min(1).max(20).optional(),
  name: z.string().trim().min(1).max(200).optional(),
})

export const listRoutesQuerySchema = z.object({
  search: z.string().trim().optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export const routeStepInputSchema = z.object({
  code: z.string().trim().min(1, 'El código del paso es obligatorio').max(30),
  name: z.string().trim().min(1, 'El nombre del paso es obligatorio').max(200),
  description: optionalTrimmedString,
  sequence: z.number().int().min(1, 'La secuencia debe ser mayor o igual a 1'),
  active: z.boolean().optional().default(true),
  productionLine: optionalTrimmedString,
})

export const saveRouteStepsSchema = z
  .object({
    steps: z.array(routeStepInputSchema).min(1, 'La ruta debe incluir al menos un paso'),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<number>()
    data.steps.forEach((step, index) => {
      if (seen.has(step.sequence)) {
        ctx.addIssue({
          code: 'custom',
          message: `La secuencia ${step.sequence} está duplicada`,
          path: ['steps', index, 'sequence'],
        })
      }
      seen.add(step.sequence)
    })
  })

export type CreateRouteInput = z.infer<typeof createRouteSchema>
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>
export type ListRoutesQuery = z.infer<typeof listRoutesQuerySchema>
export type RouteStepInput = z.infer<typeof routeStepInputSchema>
export type SaveRouteStepsInput = z.infer<typeof saveRouteStepsSchema>
