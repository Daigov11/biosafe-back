// Crea (o restablece) el primer usuario ADMIN. La contraseña se pasa por
// variable de entorno — nunca por argumento — para que no quede en el
// historial ni en la lista de procesos:
//
//   ADMIN_EMAIL=admin@biosafe.pe ADMIN_PASSWORD='...' npm run user:create-admin
import '../env.js'
import { recordAudit } from '../lib/audit.js'
import { assertPasswordPolicy, hashPassword } from '../lib/auth/password.js'
import { prisma } from '../lib/prisma.js'

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador'
  if (!email || !password) throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD')
  assertPasswordPolicy(password)

  const existing = await prisma.user.findUnique({ where: { email } })
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: hashPassword(password), role: 'ADMIN', active: true, failedLogins: 0, lockedUntil: null } })
    : await prisma.user.create({ data: { email, name, role: 'ADMIN', passwordHash: hashPassword(password) } })
  if (existing) await prisma.session.deleteMany({ where: { userId: user.id } })

  await recordAudit(prisma, { id: user.id, email: user.email, name: user.name, role: 'ADMIN' }, {
    action: existing ? 'USER_ADMIN_RESET' : 'USER_ADMIN_BOOTSTRAP',
    entity: 'User',
    entityId: user.id,
    reason: 'Alta/restablecimiento de administrador por línea de comandos',
  })
  console.log(`${existing ? 'Administrador actualizado' : 'Administrador creado'}: ${email}`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
