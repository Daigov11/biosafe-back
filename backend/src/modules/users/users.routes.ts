import { Router } from 'express'
import { z } from 'zod'
import { recordAudit } from '../../lib/audit.js'
import { assertPasswordPolicy, hashPassword } from '../../lib/auth/password.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { prisma } from '../../lib/prisma.js'
import { requirePermission } from '../../middleware/auth.js'

export const usersRouter = Router()
usersRouter.use(requirePermission('users:manage'))

const roleSchema = z.enum(['COMERCIAL', 'COSTOS', 'INGENIERIA', 'DIRECCION', 'ADMIN'])
const publicUser = { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true } as const

usersRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({ items: await prisma.user.findMany({ select: publicUser, orderBy: { email: 'asc' } }) })
}))

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  role: roleSchema,
  password: z.string().min(1).max(200),
  reason: z.string().trim().min(3, 'Indica el motivo'),
})

usersRouter.post('/', asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body)
  try {
    assertPasswordPolicy(data.password)
  } catch (error) {
    res.status(400).json({ status: 'error', message: (error as Error).message })
    return
  }
  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    res.status(409).json({ status: 'error', message: 'Ya existe un usuario con ese correo' })
    return
  }
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email: data.email, name: data.name, role: data.role, passwordHash: hashPassword(data.password) },
      select: publicUser,
    })
    await recordAudit(tx, req.user!, { action: 'USER_CREATE', entity: 'User', entityId: created.id, newValue: created, reason: data.reason })
    return created
  })
  res.status(201).json(user)
}))

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  password: z.string().min(1).max(200).optional(),
  reason: z.string().trim().min(3, 'Indica el motivo'),
})

usersRouter.patch('/:id', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id)
  const data = updateSchema.parse(req.body)
  const before = await prisma.user.findUnique({ where: { id }, select: publicUser })
  if (!before) {
    res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })
    return
  }
  const losesAdmin = before.role === 'ADMIN' && ((data.role && data.role !== 'ADMIN') || data.active === false)
  if (losesAdmin) {
    const admins = await prisma.user.count({ where: { role: 'ADMIN', active: true } })
    if (admins <= 1) {
      res.status(409).json({ status: 'error', message: 'Debe quedar al menos un administrador activo' })
      return
    }
  }
  if (data.password) {
    try {
      assertPasswordPolicy(data.password)
    } catch (error) {
      res.status(400).json({ status: 'error', message: (error as Error).message })
      return
    }
  }
  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        name: data.name,
        role: data.role,
        active: data.active,
        passwordHash: data.password ? hashPassword(data.password) : undefined,
        failedLogins: data.password ? 0 : undefined,
        lockedUntil: data.password ? null : undefined,
      },
      select: publicUser,
    })
    // Rol desactivado o contraseña restablecida: se cierran sus sesiones.
    if (data.active === false || data.password || data.role) await tx.session.deleteMany({ where: { userId: id } })
    await recordAudit(tx, req.user!, {
      action: data.role && data.role !== before.role ? 'USER_ROLE_CHANGE' : 'USER_UPDATE',
      entity: 'User',
      entityId: id,
      oldValue: before,
      newValue: { ...updated, passwordChanged: Boolean(data.password) },
      reason: data.reason,
    })
    return updated
  })
  res.json(after)
}))
