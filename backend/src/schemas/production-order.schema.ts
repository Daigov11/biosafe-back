import { z } from 'zod'

export const updateProductionOrderSchema = z.object({
  notes: z.string().trim().max(2000).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  productionDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
})

export const updateProductionOrderMaterialSchema = z.object({
  dispensedLot: z.string().trim().max(120).nullable().optional(),
  protocolNumber: z.string().trim().max(120).nullable().optional(),
  dispensedQuantity: z.number().nonnegative().nullable().optional(),
  dispensedDate: z.coerce.date().nullable().optional(),
  additionalQuantity: z.number().nonnegative().nullable().optional(),
  returnedQuantity: z.number().nonnegative().nullable().optional(),
  warehouseApproval: z.boolean().optional(),
  productionApproval: z.boolean().optional(),
})

export const updateProductionOrderSignaturesSchema = z.object({
  technicalDirectorName: z.string().trim().max(150).nullable().optional(),
  technicalDirectorDate: z.coerce.date().nullable().optional(),
  productionManagerName: z.string().trim().max(150).nullable().optional(),
  productionManagerDate: z.coerce.date().nullable().optional(),
})

export type UpdateProductionOrderInput = z.infer<typeof updateProductionOrderSchema>
export type UpdateProductionOrderMaterialInput = z.infer<typeof updateProductionOrderMaterialSchema>
export type UpdateProductionOrderSignaturesInput = z.infer<typeof updateProductionOrderSignaturesSchema>
