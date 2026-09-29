import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '../../../generated/prisma/index.js'
import { SANITARY_REGISTRATIONS_UPLOAD_DIR } from '../../lib/file-storage.js'
import { prisma } from '../../lib/prisma.js'
import type {
  CreateSanitaryRegistrationChangeInput,
  CreateSanitaryRegistrationInput,
  CreateSanitaryRegistrationItemInput,
  ListSanitaryRegistrationsQuery,
  UpdateSanitaryRegistrationChangeInput,
  UpdateSanitaryRegistrationInput,
  UpdateSanitaryRegistrationItemInput,
} from '../../schemas/sanitary-registration.schema.js'

export class SanitaryRegistrationValidationError extends Error {}

const VALIDITY_WARNING_DAYS = 60

export type SanitaryRegistrationValidity = 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | null

/**
 * La vigencia nunca se persiste: se deriva de expirationDate en cada
 * lectura, igual que otros cálculos de negocio del proyecto (PT, avances).
 */
export function computeValidity(expirationDate: Date | null): SanitaryRegistrationValidity {
  if (!expirationDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiration = new Date(expirationDate)
  expiration.setHours(0, 0, 0, 0)

  const diffDays = Math.round((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'VENCIDO'
  if (diffDays <= VALIDITY_WARNING_DAYS) return 'POR_VENCER'
  return 'VIGENTE'
}

const include = {
  items: {
    include: { product: true },
    orderBy: [{ officialItemNumber: 'asc' as const }, { id: 'asc' as const }],
  },
  changes: { orderBy: { resolutionDate: 'asc' as const } },
  documents: { orderBy: { uploadedAt: 'asc' as const } },
} satisfies Prisma.SanitaryRegistrationInclude

function withValidity<T extends { expirationDate: Date | null }>(registration: T) {
  return { ...registration, validity: computeValidity(registration.expirationDate) }
}

export async function listSanitaryRegistrations(query: ListSanitaryRegistrationsQuery) {
  const where: Prisma.SanitaryRegistrationWhereInput = {
    AND: [
      query.search
        ? {
            OR: [
              { registrationNumber: { contains: query.search } },
              { code: { contains: query.search } },
              { title: { contains: query.search } },
              { items: { some: { officialCode: { contains: query.search } } } },
              { items: { some: { officialDescription: { contains: query.search } } } },
              { items: { some: { product: { name: { contains: query.search } } } } },
              { items: { some: { product: { code: { contains: query.search } } } } },
              { changes: { some: { resolutionNumber: { contains: query.search } } } },
            ],
          }
        : {},
      query.status ? { status: query.status } : {},
      query.productId ? { items: { some: { productId: query.productId } } } : {},
    ],
  }

  const all = await prisma.sanitaryRegistration.findMany({
    where,
    include,
    orderBy: { registrationNumber: 'asc' },
  })

  const withComputedValidity = all.map(withValidity)
  const filtered = query.validity
    ? withComputedValidity.filter((item) => item.validity === query.validity)
    : withComputedValidity

  const total = filtered.length
  const start = (query.page - 1) * query.pageSize
  const items = filtered.slice(start, start + query.pageSize)

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
}

export async function getSanitaryRegistrationById(id: number) {
  const registration = await prisma.sanitaryRegistration.findUnique({ where: { id }, include })
  if (!registration) return null
  return withValidity(registration)
}

export async function createSanitaryRegistration(input: CreateSanitaryRegistrationInput) {
  try {
    const registration = await prisma.sanitaryRegistration.create({ data: input, include })
    return withValidity(registration)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new SanitaryRegistrationValidationError(
        'Ya existe un registro sanitario con ese código o número de registro',
      )
    }
    throw error
  }
}

export async function updateSanitaryRegistration(id: number, input: UpdateSanitaryRegistrationInput) {
  const existing = await prisma.sanitaryRegistration.findUnique({ where: { id } })
  if (!existing) return null

  try {
    const registration = await prisma.sanitaryRegistration.update({ where: { id }, data: input, include })
    return withValidity(registration)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new SanitaryRegistrationValidationError(
        'Ya existe un registro sanitario con ese código o número de registro',
      )
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Ítems / productos autorizados
// ---------------------------------------------------------------------------

export async function addItem(registrationId: number, input: CreateSanitaryRegistrationItemInput) {
  const registration = await prisma.sanitaryRegistration.findUnique({ where: { id: registrationId } })
  if (!registration) return null

  if (input.productId) {
    const product = await prisma.product.findUnique({ where: { id: input.productId } })
    if (!product) {
      throw new SanitaryRegistrationValidationError('El producto seleccionado no existe')
    }
  }

  return prisma.sanitaryRegistrationItem.create({
    data: { ...input, sanitaryRegistrationId: registrationId },
    include: { product: true },
  })
}

export async function updateItem(
  registrationId: number,
  itemId: number,
  input: UpdateSanitaryRegistrationItemInput,
) {
  const existing = await prisma.sanitaryRegistrationItem.findUnique({ where: { id: itemId } })
  if (!existing || existing.sanitaryRegistrationId !== registrationId) return null

  if (input.productId) {
    const product = await prisma.product.findUnique({ where: { id: input.productId } })
    if (!product) {
      throw new SanitaryRegistrationValidationError('El producto seleccionado no existe')
    }
  }

  return prisma.sanitaryRegistrationItem.update({
    where: { id: itemId },
    data: input,
    include: { product: true },
  })
}

export async function deleteItem(registrationId: number, itemId: number) {
  const existing = await prisma.sanitaryRegistrationItem.findUnique({ where: { id: itemId } })
  if (!existing || existing.sanitaryRegistrationId !== registrationId) return null
  await prisma.sanitaryRegistrationItem.delete({ where: { id: itemId } })
  return existing
}

// ---------------------------------------------------------------------------
// Resoluciones / cambios
// ---------------------------------------------------------------------------

export async function addChange(registrationId: number, input: CreateSanitaryRegistrationChangeInput) {
  const registration = await prisma.sanitaryRegistration.findUnique({ where: { id: registrationId } })
  if (!registration) return null

  return prisma.sanitaryRegistrationChange.create({
    data: { ...input, sanitaryRegistrationId: registrationId },
  })
}

export async function updateChange(
  registrationId: number,
  changeId: number,
  input: UpdateSanitaryRegistrationChangeInput,
) {
  const existing = await prisma.sanitaryRegistrationChange.findUnique({ where: { id: changeId } })
  if (!existing || existing.sanitaryRegistrationId !== registrationId) return null

  return prisma.sanitaryRegistrationChange.update({ where: { id: changeId }, data: input })
}

export async function deleteChange(registrationId: number, changeId: number) {
  const existing = await prisma.sanitaryRegistrationChange.findUnique({ where: { id: changeId } })
  if (!existing || existing.sanitaryRegistrationId !== registrationId) return null
  await prisma.sanitaryRegistrationChange.delete({ where: { id: changeId } })
  return existing
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export async function addDocument(
  registrationId: number,
  file: { originalname: string; filename: string; mimetype: string; size: number },
  meta: { changeId?: number; documentType: string; documentDate?: Date },
) {
  const existing = await prisma.sanitaryRegistration.findUnique({ where: { id: registrationId } })
  if (!existing) return null

  if (meta.changeId) {
    const change = await prisma.sanitaryRegistrationChange.findUnique({ where: { id: meta.changeId } })
    if (!change || change.sanitaryRegistrationId !== registrationId) {
      throw new SanitaryRegistrationValidationError(
        'La resolución/cambio seleccionado no pertenece a este registro',
      )
    }
  }

  return prisma.sanitaryRegistrationDocument.create({
    data: {
      sanitaryRegistrationId: registrationId,
      sanitaryRegistrationChangeId: meta.changeId,
      fileName: file.originalname,
      storagePath: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
      documentType: meta.documentType,
      documentDate: meta.documentDate,
    },
  })
}

export async function getDocumentForDownload(registrationId: number, documentId: number) {
  const document = await prisma.sanitaryRegistrationDocument.findUnique({ where: { id: documentId } })
  if (!document || document.sanitaryRegistrationId !== registrationId) return null

  const absolutePath = path.join(SANITARY_REGISTRATIONS_UPLOAD_DIR, document.storagePath)
  if (!fs.existsSync(absolutePath)) return null

  return { document, absolutePath }
}

// ---------------------------------------------------------------------------
// Vista desde Producto
// ---------------------------------------------------------------------------

export async function listByProductId(productId: number) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!product) return null

  const items = await prisma.sanitaryRegistrationItem.findMany({
    where: { productId, active: true, sanitaryRegistration: { active: true } },
    include: { sanitaryRegistration: { include: { documents: true } } },
    orderBy: { sanitaryRegistration: { registrationNumber: 'asc' } },
  })

  return items.map((item) => ({
    item: {
      id: item.id,
      officialCode: item.officialCode,
      officialDescription: item.officialDescription,
    },
    registration: withValidity(item.sanitaryRegistration),
  }))
}
