import { z } from 'zod'

const statusEnum = z.enum(['DRAFT', 'IN_PROCESS', 'VALID', 'EXPIRING', 'EXPIRED', 'SUSPENDED'])
const validityEnum = z.enum(['VIGENTE', 'POR_VENCER', 'VENCIDO'])
export const changeTypeEnum = z.enum([
  'INSCRIPCION',
  'MODIFICACION',
  'RENOVACION',
  'ACTUALIZACION',
  'OTRO',
])

const optionalTrimmedString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined))

// -----------------------------------------------------------------------
// Registro Sanitario
// -----------------------------------------------------------------------

export const createSanitaryRegistrationSchema = z.object({
  code: z.string().trim().min(1, 'El código interno es obligatorio').max(60),
  registrationNumber: z.string().trim().min(1, 'El número de Registro Sanitario es obligatorio').max(60),
  title: z.string().trim().min(1, 'El nombre del dispositivo médico es obligatorio').max(300),
  medicalDeviceClass: optionalTrimmedString,
  issuingAuthority: optionalTrimmedString,
  manufacturer: optionalTrimmedString,
  country: optionalTrimmedString,
  brand: optionalTrimmedString,
  issueDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  status: statusEnum.optional().default('VALID'),
  notes: z.string().trim().max(4000).optional(),
  active: z.boolean().optional().default(true),
})

export const updateSanitaryRegistrationSchema = z.object({
  code: z.string().trim().min(1).max(60).optional(),
  registrationNumber: z.string().trim().min(1).max(60).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  medicalDeviceClass: z.string().trim().max(200).nullable().optional(),
  issuingAuthority: z.string().trim().max(200).nullable().optional(),
  manufacturer: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  issueDate: z.coerce.date().nullable().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  status: statusEnum.optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  active: z.boolean().optional(),
})

export const listSanitaryRegistrationsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: statusEnum.optional(),
  validity: validityEnum.optional(),
  productId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).optional().default(50),
})

// -----------------------------------------------------------------------
// Ítem / producto autorizado
// -----------------------------------------------------------------------

export const createSanitaryRegistrationItemSchema = z.object({
  officialItemNumber: z.coerce.number().int().positive().optional(),
  officialCode: z.string().trim().min(1, 'El código oficial es obligatorio').max(60),
  officialDescription: z.string().trim().min(1, 'La descripción oficial es obligatoria').max(300),
  productId: z.coerce.number().int().positive().optional(),
  materialSummary: optionalTrimmedString,
  grammageSummary: optionalTrimmedString,
  dimensionsSummary: optionalTrimmedString,
  colorsSummary: optionalTrimmedString,
  presentationSummary: optionalTrimmedString,
  notes: optionalTrimmedString,
  active: z.boolean().optional().default(true),
})

export const updateSanitaryRegistrationItemSchema = z.object({
  officialItemNumber: z.coerce.number().int().positive().nullable().optional(),
  officialCode: z.string().trim().min(1).max(60).optional(),
  officialDescription: z.string().trim().min(1).max(300).optional(),
  productId: z.coerce.number().int().positive().nullable().optional(),
  materialSummary: z.string().trim().max(2000).nullable().optional(),
  grammageSummary: z.string().trim().max(200).nullable().optional(),
  dimensionsSummary: z.string().trim().max(4000).nullable().optional(),
  colorsSummary: z.string().trim().max(2000).nullable().optional(),
  presentationSummary: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().optional(),
})

// -----------------------------------------------------------------------
// Resolución / cambio
// -----------------------------------------------------------------------

export const createSanitaryRegistrationChangeSchema = z.object({
  resolutionNumber: z.string().trim().min(1, 'El número de resolución es obligatorio').max(120),
  changeType: changeTypeEnum,
  resolutionDate: z.coerce.date().optional(),
  effectiveDate: z.coerce.date().optional(),
  description: z.string().trim().min(1, 'La descripción es obligatoria').max(4000),
  notes: optionalTrimmedString,
})

export const updateSanitaryRegistrationChangeSchema = z.object({
  resolutionNumber: z.string().trim().min(1).max(120).optional(),
  changeType: changeTypeEnum.optional(),
  resolutionDate: z.coerce.date().nullable().optional(),
  effectiveDate: z.coerce.date().nullable().optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

// -----------------------------------------------------------------------
// Documentos
// -----------------------------------------------------------------------

export const SANITARY_DOCUMENT_TYPES = [
  'RESOLUCION_DIRECTORAL',
  'EXPEDIENTE_REGISTRO_SANITARIO',
  'CERTIFICADO_LIBRE_COMERCIALIZACION',
  'FICHA_TECNICA',
  'OTRO',
] as const

export const uploadSanitaryRegistrationDocumentSchema = z.object({
  changeId: z.coerce.number().int().positive().optional(),
  documentType: z.string().trim().min(1, 'El tipo de documento es obligatorio').max(60),
  documentDate: z.coerce.date().optional(),
})

export type CreateSanitaryRegistrationInput = z.infer<typeof createSanitaryRegistrationSchema>
export type UpdateSanitaryRegistrationInput = z.infer<typeof updateSanitaryRegistrationSchema>
export type ListSanitaryRegistrationsQuery = z.infer<typeof listSanitaryRegistrationsQuerySchema>
export type CreateSanitaryRegistrationItemInput = z.infer<typeof createSanitaryRegistrationItemSchema>
export type UpdateSanitaryRegistrationItemInput = z.infer<typeof updateSanitaryRegistrationItemSchema>
export type CreateSanitaryRegistrationChangeInput = z.infer<typeof createSanitaryRegistrationChangeSchema>
export type UpdateSanitaryRegistrationChangeInput = z.infer<typeof updateSanitaryRegistrationChangeSchema>
export type UploadSanitaryRegistrationDocumentInput = z.infer<
  typeof uploadSanitaryRegistrationDocumentSchema
>
