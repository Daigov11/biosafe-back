import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  createSanitaryRegistrationChangeSchema,
  createSanitaryRegistrationItemSchema,
  createSanitaryRegistrationSchema,
  listSanitaryRegistrationsQuerySchema,
  updateSanitaryRegistrationChangeSchema,
  updateSanitaryRegistrationItemSchema,
  updateSanitaryRegistrationSchema,
  uploadSanitaryRegistrationDocumentSchema,
} from '../../schemas/sanitary-registration.schema.js'
import * as service from './sanitary-registrations.service.js'
import { SanitaryRegistrationValidationError } from './sanitary-registrations.service.js'

const idParamSchema = z.coerce.number().int().positive()

function handleValidationError(error: unknown, res: Response): boolean {
  if (error instanceof SanitaryRegistrationValidationError) {
    res.status(400).json({ status: 'error', message: error.message })
    return true
  }
  return false
}

export async function list(req: Request, res: Response) {
  const query = listSanitaryRegistrationsQuerySchema.parse(req.query)
  const result = await service.listSanitaryRegistrations(query)
  res.json(result)
}

export async function getById(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const registration = await service.getSanitaryRegistrationById(id)
  if (!registration) {
    res.status(404).json({ status: 'error', message: 'Registro sanitario no encontrado' })
    return
  }
  res.json(registration)
}

export async function create(req: Request, res: Response) {
  const data = createSanitaryRegistrationSchema.parse(req.body)
  try {
    const registration = await service.createSanitaryRegistration(data)
    res.status(201).json(registration)
  } catch (error) {
    if (handleValidationError(error, res)) return
    throw error
  }
}

export async function update(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updateSanitaryRegistrationSchema.parse(req.body)
  try {
    const registration = await service.updateSanitaryRegistration(id, data)
    if (!registration) {
      res.status(404).json({ status: 'error', message: 'Registro sanitario no encontrado' })
      return
    }
    res.json(registration)
  } catch (error) {
    if (handleValidationError(error, res)) return
    throw error
  }
}

export async function addItem(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = createSanitaryRegistrationItemSchema.parse(req.body)
  try {
    const item = await service.addItem(id, data)
    if (!item) {
      res.status(404).json({ status: 'error', message: 'Registro sanitario no encontrado' })
      return
    }
    res.status(201).json(item)
  } catch (error) {
    if (handleValidationError(error, res)) return
    throw error
  }
}

export async function updateItem(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const itemId = idParamSchema.parse(req.params.itemId)
  const data = updateSanitaryRegistrationItemSchema.parse(req.body)
  try {
    const item = await service.updateItem(id, itemId, data)
    if (!item) {
      res.status(404).json({ status: 'error', message: 'Ítem no encontrado' })
      return
    }
    res.json(item)
  } catch (error) {
    if (handleValidationError(error, res)) return
    throw error
  }
}

export async function removeItem(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const itemId = idParamSchema.parse(req.params.itemId)
  const deleted = await service.deleteItem(id, itemId)
  if (!deleted) {
    res.status(404).json({ status: 'error', message: 'Ítem no encontrado' })
    return
  }
  res.status(204).send()
}

export async function addChange(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = createSanitaryRegistrationChangeSchema.parse(req.body)
  const change = await service.addChange(id, data)
  if (!change) {
    res.status(404).json({ status: 'error', message: 'Registro sanitario no encontrado' })
    return
  }
  res.status(201).json(change)
}

export async function updateChange(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const changeId = idParamSchema.parse(req.params.changeId)
  const data = updateSanitaryRegistrationChangeSchema.parse(req.body)
  const change = await service.updateChange(id, changeId, data)
  if (!change) {
    res.status(404).json({ status: 'error', message: 'Resolución/cambio no encontrado' })
    return
  }
  res.json(change)
}

export async function removeChange(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const changeId = idParamSchema.parse(req.params.changeId)
  const deleted = await service.deleteChange(id, changeId)
  if (!deleted) {
    res.status(404).json({ status: 'error', message: 'Resolución/cambio no encontrado' })
    return
  }
  res.status(204).send()
}

export async function uploadDocument(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const meta = uploadSanitaryRegistrationDocumentSchema.parse(req.body)
  const file = req.file
  if (!file) {
    res.status(400).json({ status: 'error', message: 'Debe adjuntar un archivo (PDF, PNG o JPG)' })
    return
  }

  try {
    const document = await service.addDocument(id, file, {
      changeId: meta.changeId,
      documentType: meta.documentType,
      documentDate: meta.documentDate,
    })
    if (!document) {
      res.status(404).json({ status: 'error', message: 'Registro sanitario no encontrado' })
      return
    }
    res.status(201).json(document)
  } catch (error) {
    if (handleValidationError(error, res)) return
    throw error
  }
}

export async function downloadDocument(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const documentId = idParamSchema.parse(req.params.documentId)

  const result = await service.getDocumentForDownload(id, documentId)
  if (!result) {
    res.status(404).json({ status: 'error', message: 'Documento no encontrado' })
    return
  }

  res.download(result.absolutePath, result.document.fileName)
}

export async function listByProduct(req: Request, res: Response) {
  const productId = idParamSchema.parse(req.params.id)
  const registrations = await service.listByProductId(productId)
  if (!registrations) {
    res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
    return
  }
  res.json(registrations)
}
