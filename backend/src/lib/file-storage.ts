import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'

export const SANITARY_REGISTRATIONS_UPLOAD_DIR = path.resolve(
  __dirname,
  '../../uploads/sanitary-registrations',
)

fs.mkdirSync(SANITARY_REGISTRATIONS_UPLOAD_DIR, { recursive: true })

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, SANITARY_REGISTRATIONS_UPLOAD_DIR)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uniqueSuffix}${ext}`)
  },
})

export const sanitaryRegistrationDocumentUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Tipo de archivo no permitido. Solo se aceptan PDF, PNG o JPG.'))
      return
    }
    cb(null, true)
  },
}).single('file')
