import { Prisma } from '../../../generated/prisma/index.js'
import { prisma } from '../../lib/prisma.js'
import { buildCharacteristicsSummary, buildKitSummary } from '../../lib/product-characteristics.js'
import { computeMaterialYieldEstimate } from '../product-material-yields/product-material-yields.service.js'
import { computeValidity } from '../sanitary-registrations/sanitary-registrations.service.js'
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from '../../schemas/product.schema.js'

const productInclude = {
  family: true,
  category: true,
  route: true,
} satisfies Prisma.ProductInclude

const dossierBomItemInclude = {
  rawMaterial: true,
  componentProduct: true,
} satisfies Prisma.BomItemInclude

type DossierBomItem = Prisma.BomItemGetPayload<{ include: typeof dossierBomItemInclude }>

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>

/**
 * El resumen de kit requiere leer el BOM del producto; se calcula solo
 * bajo demanda (detalle) para no penalizar el listado con N consultas
 * extra por fila. El listado solo recibe `characteristicsSummary`.
 */
function withCharacteristics<T extends ProductWithRelations>(product: T) {
  return { ...product, characteristicsSummary: buildCharacteristicsSummary(product) }
}

async function buildKitSummaryForProduct(productId: number): Promise<string | null> {
  const header = await prisma.bomHeader.findUnique({
    where: { productId },
    include: {
      items: {
        include: { componentProduct: true, rawMaterial: true },
        orderBy: { sequence: 'asc' },
      },
    },
  })
  if (!header) return null

  // Piezas comerciales del kit: ítems de primer nivel con
  // countsTowardKitPieces = true, sin importar componentType (p.ej. un
  // indicador químico RAW_MATERIAL puede contar como pieza).
  const pieces = header.items
    .filter((item) => item.countsTowardKitPieces)
    .map((item) => ({
      code: (item.componentType === 'PRODUCT' ? item.componentProduct?.code : item.rawMaterial?.code) ?? '',
      name: (item.componentType === 'PRODUCT' ? item.componentProduct?.name : item.rawMaterial?.name) ?? '',
      quantityPerUnit: Number(item.quantity),
    }))

  return buildKitSummary(pieces)
}

export async function listProducts(query: ListProductsQuery) {
  const where: Prisma.ProductWhereInput = {
    AND: [
      query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {},
      query.familyId ? { familyId: query.familyId } : {},
      query.categoryId ? { categoryId: query.categoryId } : {},
      query.productType ? { productType: query.productType } : {},
      query.active !== undefined ? { active: query.active } : {},
    ],
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { code: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ])

  return {
    items: items.map(withCharacteristics),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
}

export async function getProductById(id: number) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  })
  if (!product) return null

  const kitSummary = product.productType === 'KIT' ? await buildKitSummaryForProduct(id) : null
  return { ...withCharacteristics(product), kitSummary }
}

export async function createProduct(data: CreateProductInput) {
  const product = await prisma.product.create({
    data,
    include: productInclude,
  })
  return withCharacteristics(product)
}

export async function updateProduct(id: number, data: UpdateProductInput) {
  const exists = await prisma.product.findUnique({ where: { id } })
  if (!exists) return null

  const product = await prisma.product.update({
    where: { id },
    data,
    include: productInclude,
  })
  return withCharacteristics(product)
}

export async function getProductUsedInProducts(id: number) {
  const exists = await prisma.product.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return null

  const items = await prisma.bomItem.findMany({
    where: { componentProductId: id },
    include: { bomHeader: { include: { product: true } } },
    orderBy: { bomHeader: { product: { code: 'asc' } } },
  })

  return items.map((item) => ({
    productId: item.bomHeader.product.id,
    productCode: item.bomHeader.product.code,
    productName: item.bomHeader.product.name,
    quantity: Number(item.quantity),
    unit: item.unit,
    componentClass: item.componentClass,
  }))
}

function mapDossierBomItem(item: DossierBomItem) {
  const component = item.componentType === 'RAW_MATERIAL' ? item.rawMaterial : item.componentProduct
  return {
    id: item.id,
    componentType: item.componentType,
    code: component?.code ?? '',
    name: component?.name ?? '',
    quantity: Number(item.quantity),
    unit: item.unit,
    wastePercentage: item.wastePercentage ? Number(item.wastePercentage) : null,
    requiredWidth: item.requiredWidth ? Number(item.requiredWidth) : null,
    requiredLength: item.requiredLength ? Number(item.requiredLength) : null,
    notes: item.notes,
    required: item.required,
    countsTowardKitPieces: item.countsTowardKitPieces,
  }
}

/**
 * Ficha Técnica / Dossier de Producto (Demo 2): consolida identidad,
 * características, Registro Sanitario, BOM, rendimiento de material,
 * kits donde se usa y trazabilidad de lotes/OP — todo derivado en el
 * momento de la consulta, reutilizando los mismos modelos y cálculos que
 * el resto del ERP (BOM, rendimiento, `usedInProducts`). Los datos
 * regulatorios SIEMPRE vienen de `SanitaryRegistrationItem` (nunca una
 * copia editable en `Product`): si no hay ningún ítem con
 * `productId` = este producto, `sanitaryRegistrations` es un arreglo
 * vacío — el front debe mostrar "Sin vínculo regulatorio confirmado",
 * nunca inventar una correspondencia.
 */
export async function getProductTechnicalDossier(id: number) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude })
  if (!product) return null

  const sanitaryRegistrationItems = await prisma.sanitaryRegistrationItem.findMany({
    where: { productId: id },
    include: {
      sanitaryRegistration: {
        include: {
          changes: { orderBy: { resolutionDate: 'asc' } },
          documents: { orderBy: { uploadedAt: 'asc' } },
        },
      },
    },
    orderBy: { id: 'asc' },
  })

  const sanitaryRegistrations = sanitaryRegistrationItems.map((item) => ({
    item: {
      id: item.id,
      officialItemNumber: item.officialItemNumber,
      officialCode: item.officialCode,
      officialDescription: item.officialDescription,
      materialSummary: item.materialSummary,
      grammageSummary: item.grammageSummary,
      dimensionsSummary: item.dimensionsSummary,
      colorsSummary: item.colorsSummary,
      presentationSummary: item.presentationSummary,
      notes: item.notes,
    },
    registration: {
      id: item.sanitaryRegistration.id,
      code: item.sanitaryRegistration.code,
      registrationNumber: item.sanitaryRegistration.registrationNumber,
      title: item.sanitaryRegistration.title,
      medicalDeviceClass: item.sanitaryRegistration.medicalDeviceClass,
      issuingAuthority: item.sanitaryRegistration.issuingAuthority,
      manufacturer: item.sanitaryRegistration.manufacturer,
      country: item.sanitaryRegistration.country,
      brand: item.sanitaryRegistration.brand,
      issueDate: item.sanitaryRegistration.issueDate,
      expirationDate: item.sanitaryRegistration.expirationDate,
      status: item.sanitaryRegistration.status,
      validity: computeValidity(item.sanitaryRegistration.expirationDate),
      active: item.sanitaryRegistration.active,
    },
    changes: item.sanitaryRegistration.changes,
    documents: item.sanitaryRegistration.documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      documentType: doc.documentType,
      fileSize: doc.fileSize,
      documentDate: doc.documentDate,
      uploadedAt: doc.uploadedAt,
    })),
  }))

  const bomHeader = await prisma.bomHeader.findUnique({
    where: { productId: id },
    include: { items: { include: dossierBomItemInclude, orderBy: { sequence: 'asc' } } },
  })

  const bom = bomHeader
    ? {
        active: bomHeader.active,
        notes: bomHeader.notes,
        productiveMaterials: bomHeader.items
          .filter((i) => i.componentType === 'RAW_MATERIAL' && i.componentClass === 'PRODUCTIVE_MATERIAL')
          .map(mapDossierBomItem),
        packagingMaterials: bomHeader.items
          .filter((i) => i.componentType === 'RAW_MATERIAL' && i.componentClass === 'PACKAGING_MATERIAL')
          .map(mapDossierBomItem),
        componentProducts: bomHeader.items.filter((i) => i.componentType === 'PRODUCT').map(mapDossierBomItem),
      }
    : null

  const materialYieldRows = await prisma.productMaterialYield.findMany({
    where: { productId: id },
    include: { rawMaterial: true },
    orderBy: [{ effectiveFrom: 'desc' }, { sourceGrammage: 'asc' }],
  })
  const materialYields = materialYieldRows.map((y) => ({
    id: y.id,
    rawMaterial: { id: y.rawMaterial.id, code: y.rawMaterial.code, name: y.rawMaterial.name },
    productSize: y.productSize,
    cutWidth: y.cutWidth ? Number(y.cutWidth) : null,
    cutLength: y.cutLength ? Number(y.cutLength) : null,
    unitsPerRoll: y.unitsPerRoll,
    sourceRollWidth: y.sourceRollWidth ? Number(y.sourceRollWidth) : null,
    sourceRollLength: y.sourceRollLength ? Number(y.sourceRollLength) : null,
    sourceGrammage: y.sourceGrammage ? Number(y.sourceGrammage) : null,
    effectiveFrom: y.effectiveFrom,
    notes: y.notes,
    active: y.active,
  }))

  const usedInKits = (await getProductUsedInProducts(id)) ?? []

  const lots = await prisma.lot.findMany({
    where: { productId: id },
    include: {
      order: { include: { customer: true } },
      productionOrder: { select: { id: true, code: true, status: true } },
    },
    orderBy: { id: 'desc' },
  })

  // Rollos estimados por lote real (nunca un escenario hipotético): se
  // reutiliza el mismo cálculo de Planeamiento, aplicado a la cantidad de
  // cada lote real de este producto.
  const traceability = await Promise.all(
    lots.map(async (lot) => ({
      id: lot.id,
      lotCode: lot.lotCode,
      quantity: Number(lot.quantity),
      status: lot.status,
      order: { code: lot.order.code, customer: lot.order.customer.name },
      productionOrder: lot.productionOrder
        ? { id: lot.productionOrder.id, code: lot.productionOrder.code, status: lot.productionOrder.status }
        : null,
      materialYieldEstimate: await computeMaterialYieldEstimate(id, Number(lot.quantity)),
    })),
  )

  return {
    product: {
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      productType: product.productType,
      size: product.size,
      width: product.width ? Number(product.width) : null,
      length: product.length ? Number(product.length) : null,
      grammage: product.grammage ? Number(product.grammage) : null,
      presentation: product.presentation,
      sterile: product.sterile,
      fenestrated: product.fenestrated,
      reinforced: product.reinforced,
      laminated: product.laminated,
      usesAdhesive: product.usesAdhesive,
      usesLabel: product.usesLabel,
      usesBag: product.usesBag,
      active: product.active,
      family: product.family ? { id: product.family.id, code: product.family.code, name: product.family.name } : null,
      category: product.category
        ? { id: product.category.id, code: product.category.code, name: product.category.name }
        : null,
      route: product.route ? { id: product.route.id, code: product.route.code, name: product.route.name } : null,
      characteristicsSummary: buildCharacteristicsSummary(product),
    },
    sanitaryRegistrations,
    bom,
    materialYields,
    usedInKits,
    traceability,
  }
}
