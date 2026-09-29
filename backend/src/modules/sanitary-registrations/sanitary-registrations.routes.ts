import type { NextFunction, Request, Response } from 'express'
import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import { sanitaryRegistrationDocumentUpload } from '../../lib/file-storage.js'
import * as controller from './sanitary-registrations.controller.js'

export const sanitaryRegistrationsRouter = Router()

function handleUpload(req: Request, res: Response, next: NextFunction) {
  sanitaryRegistrationDocumentUpload(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : 'No se pudo procesar el archivo'
      res.status(400).json({ status: 'error', message })
      return
    }
    next()
  })
}

sanitaryRegistrationsRouter.get('/', asyncHandler(controller.list))
sanitaryRegistrationsRouter.get('/:id', asyncHandler(controller.getById))
sanitaryRegistrationsRouter.post('/', asyncHandler(controller.create))
sanitaryRegistrationsRouter.put('/:id', asyncHandler(controller.update))

sanitaryRegistrationsRouter.post('/:id/items', asyncHandler(controller.addItem))
sanitaryRegistrationsRouter.put('/:id/items/:itemId', asyncHandler(controller.updateItem))
sanitaryRegistrationsRouter.delete('/:id/items/:itemId', asyncHandler(controller.removeItem))

sanitaryRegistrationsRouter.post('/:id/changes', asyncHandler(controller.addChange))
sanitaryRegistrationsRouter.put('/:id/changes/:changeId', asyncHandler(controller.updateChange))
sanitaryRegistrationsRouter.delete('/:id/changes/:changeId', asyncHandler(controller.removeChange))

sanitaryRegistrationsRouter.post(
  '/:id/documents',
  handleUpload,
  asyncHandler(controller.uploadDocument),
)
sanitaryRegistrationsRouter.get(
  '/:id/documents/:documentId/download',
  asyncHandler(controller.downloadDocument),
)

// Se monta también en /api/products/:id/sanitary-registrations con mergeParams.
export const productSanitaryRegistrationsRouter = Router({ mergeParams: true })
productSanitaryRegistrationsRouter.get('/', asyncHandler(controller.listByProduct))
