import { Prisma } from '../../../generated/prisma/index.js'
import { prisma } from '../../lib/prisma.js'
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
} from '../../schemas/customer.schema.js'

export async function listCustomers(query: ListCustomersQuery) {
  const where: Prisma.CustomerWhereInput = {
    AND: [
      query.search ? { name: { contains: query.search } } : {},
      query.active !== undefined ? { active: query.active } : {},
    ],
  }

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.customer.count({ where }),
  ])

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

export function getCustomerById(id: number) {
  return prisma.customer.findUnique({ where: { id } })
}

export function createCustomer(data: CreateCustomerInput) {
  return prisma.customer.create({ data })
}

export async function updateCustomer(id: number, data: UpdateCustomerInput) {
  const exists = await prisma.customer.findUnique({ where: { id } })
  if (!exists) return null
  return prisma.customer.update({ where: { id }, data })
}
