import type { Request, Response } from 'express'
import { z } from 'zod'
import { CodeConflictError } from '../../lib/code-generator.js'
import { createQuoteSchema, listQuotesQuerySchema, updateQuoteSchema } from '../../schemas/quote.schema.js'
import * as quotesService from './quotes.service.js'
import { QuoteValidationError } from './quotes.service.js'

const idParamSchema = z.coerce.number().int().positive()

export async function list(req: Request, res: Response) {
  const query = listQuotesQuerySchema.parse(req.query)
  const result = await quotesService.listQuotes(query)
  res.json(result)
}

export async function getById(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const quote = await quotesService.getQuoteById(id)

  if (!quote) {
    res.status(404).json({ status: 'error', message: 'Cotización no encontrada' })
    return
  }

  res.json(quote)
}

export async function create(req: Request, res: Response) {
  const data = createQuoteSchema.parse(req.body)

  try {
    const quote = await quotesService.createQuote(data)
    res.status(201).json(quote)
  } catch (error) {
    if (error instanceof QuoteValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    if (error instanceof CodeConflictError) {
      res.status(409).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function update(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)
  const data = updateQuoteSchema.parse(req.body)

  try {
    const quote = await quotesService.updateQuote(id, data)

    if (!quote) {
      res.status(404).json({ status: 'error', message: 'Cotización no encontrada' })
      return
    }

    res.json(quote)
  } catch (error) {
    if (error instanceof QuoteValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}

export async function approve(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id)

  try {
    const result = await quotesService.approveQuote(id)

    if (!result) {
      res.status(404).json({ status: 'error', message: 'Cotización no encontrada' })
      return
    }

    res.json(result)
  } catch (error) {
    if (error instanceof QuoteValidationError) {
      res.status(400).json({ status: 'error', message: error.message })
      return
    }
    if (error instanceof CodeConflictError) {
      res.status(409).json({ status: 'error', message: error.message })
      return
    }
    throw error
  }
}
