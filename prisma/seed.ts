import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '../backend/generated/prisma/index.js'

const prisma = new PrismaClient()

const SANITARY_UPLOAD_DIR = path.resolve(__dirname, '../backend/uploads/sanitary-registrations')

async function seedUnits() {
  const units = [
    { code: 'MT', name: 'Metro', symbol: 'm' },
    { code: 'M2', name: 'Metro cuadrado', symbol: 'm²' },
    { code: 'KG', name: 'Kilogramo', symbol: 'kg' },
    { code: 'GR', name: 'Gramo', symbol: 'g' },
    { code: 'UN', name: 'Unidad', symbol: 'un' },
    { code: 'RO', name: 'Rollo', symbol: 'rollo' },
    { code: 'CJ', name: 'Caja', symbol: 'caja' },
    { code: 'PQ', name: 'Paquete', symbol: 'paq' },
  ]

  for (const unit of units) {
    await prisma.unit.upsert({
      where: { code: unit.code },
      update: unit,
      create: unit,
    })
  }
}

async function seedFamiliesAndCategories() {
  const families = [
    {
      code: 'TELA',
      name: 'Telas no tejidas',
      description: 'Telas SMS, SPUNBOND y laminados usados como material base.',
      categories: [
        { code: 'TELA-SMS', name: 'Tela SMS' },
        { code: 'TELA-SPUNBOND', name: 'Tela Spunbond' },
      ],
    },
    {
      code: 'ADHESIVO',
      name: 'Adhesivos',
      description: 'Cintas y adhesivos usados en el cierre y fijación de productos.',
      categories: [{ code: 'ADH-DOBLE-FAZ', name: 'Adhesivo doble faz' }],
    },
    {
      code: 'LAMINADO',
      name: 'Laminados',
      description: 'Laminados absorbentes e impermeables.',
      categories: [{ code: 'LAM-ABS-IMP', name: 'Laminado absorbente/impermeable' }],
    },
    {
      code: 'EMPAQUE',
      name: 'Material de empaque',
      description: 'Bolsas, cajas y sobres para empaque primario y secundario.',
      categories: [
        { code: 'EMP-BOLSA', name: 'Bolsa' },
        { code: 'EMP-CAJA', name: 'Caja' },
        { code: 'EMP-SOBRE', name: 'Sobre' },
      ],
    },
    {
      code: 'ETIQUETADO',
      name: 'Etiquetado y control',
      description: 'Stickers, indicadores químicos y etiquetas.',
      categories: [
        { code: 'ETQ-STICKER', name: 'Sticker' },
        { code: 'ETQ-INDICADOR', name: 'Indicador químico' },
      ],
    },
    {
      code: 'CONFECCION',
      name: 'Confección (tratados como materia prima)',
      description:
        'Batas, mangas y puños que hoy se gestionan como materia prima por costumbre operativa.',
      categories: [
        { code: 'CONF-BATA', name: 'Bata quirúrgica' },
        { code: 'CONF-MANGA', name: 'Manga' },
        { code: 'CONF-PUNO', name: 'Puño' },
      ],
    },
    {
      code: 'REFUERZO',
      name: 'Refuerzos absorbentes',
      description: 'Refuerzos ultra-absorbentes usados en zonas críticas de campos y batas.',
      categories: [
        { code: 'REF-ULTRA-ABS', name: 'Refuerzo ultra-absorbente' },
        { code: 'REF-SMS', name: 'Refuerzo SMS' },
      ],
    },
    {
      code: 'PAPEL',
      name: 'Papeles técnicos',
      description: 'Papel absorbente y papel removible/siliconado.',
      categories: [
        { code: 'PAP-ABSORBENTE', name: 'Papel absorbente' },
        { code: 'PAP-SILICONADO', name: 'Papel removible/siliconado' },
      ],
    },
    {
      code: 'CINTA',
      name: 'Cintas de amarre',
      description: 'Cintas SMS/polipropileno para amarre y sujeción.',
      categories: [{ code: 'CIN-AMARRE', name: 'Cinta de amarre' }],
    },
  ]

  for (const family of families) {
    const createdFamily = await prisma.materialFamily.upsert({
      where: { code: family.code },
      update: { name: family.name, description: family.description },
      create: { code: family.code, name: family.name, description: family.description },
    })

    for (const category of family.categories) {
      await prisma.materialCategory.upsert({
        where: { code: category.code },
        update: { name: category.name, familyId: createdFamily.id },
        create: { code: category.code, name: category.name, familyId: createdFamily.id },
      })
    }
  }
}

async function seedRawMaterials() {
  const familyByCode = Object.fromEntries(
    (await prisma.materialFamily.findMany()).map((f) => [f.code, f.id]),
  )
  const categoryByCode = Object.fromEntries(
    (await prisma.materialCategory.findMany()).map((c) => [c.code, c.id]),
  )
  const unitByCode = Object.fromEntries((await prisma.unit.findMany()).map((u) => [u.code, u.id]))

  const materials = [
    {
      code: 'AD-1850',
      name: 'Adhesivo doble faz 1.8cm x 50m',
      description: 'Adhesivo doble faz para cierre de campos y batas.',
      type: 'ADHESIVO',
      familyId: familyByCode.ADHESIVO,
      categoryId: categoryByCode['ADH-DOBLE-FAZ'],
      width: 0.018,
      widthUnit: 'm',
      length: 50,
      lengthUnit: 'm',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 120,
    },
    {
      code: 'AD-3050',
      name: 'Adhesivo doble faz 3.0cm x 50m',
      description: 'Adhesivo doble faz de mayor ancho para refuerzos.',
      type: 'ADHESIVO',
      familyId: familyByCode.ADHESIVO,
      categoryId: categoryByCode['ADH-DOBLE-FAZ'],
      width: 0.03,
      widthUnit: 'm',
      length: 50,
      lengthUnit: 'm',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 85,
    },
    {
      code: 'TELA-SMS-35',
      name: 'Tela PP SMS 35g',
      description: 'Tela no tejida SMS 35g/m², ancho y largo variables según rollo.',
      type: 'TELA',
      familyId: familyByCode.TELA,
      categoryId: categoryByCode['TELA-SMS'],
      grammage: 35,
      grammageUnit: 'g/m²',
      width: 1.6,
      widthUnit: 'm',
      length: 100,
      lengthUnit: 'm',
      // Peso real declarado por el proveedor (ficha de rollo), distinto del
      // teórico calculado (gramaje × ancho × largo / 1000 ≈ 5.6 kg) — la
      // demo muestra ambos valores por separado, nunca uno sobre el otro.
      netWeightPerRollKg: 5.75,
      color: 'Azul',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 2400,
    },
    {
      code: 'TELA-SMS-25',
      name: 'Tela PP SMS 25g',
      description: 'Tela no tejida SMS 25g/m² para productos livianos.',
      type: 'TELA',
      familyId: familyByCode.TELA,
      categoryId: categoryByCode['TELA-SMS'],
      grammage: 25,
      grammageUnit: 'g/m²',
      width: 1.6,
      widthUnit: 'm',
      length: 150,
      lengthUnit: 'm',
      netWeightPerRollKg: 6.0,
      color: 'Verde',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 1800,
    },
    {
      code: 'TELA-SMS-40',
      name: 'Tela PP SMS 40g',
      description:
        'Tela no tejida SMS 40g/m², rollo 2.1 x 2800 m. Iteración 12 — Rendimiento de ' +
        'Mandiles por Rollo de Tela, fuente: docs/rendimiento de mandiles.xlsx. Sin peso ' +
        'declarado de proveedor (la ficha de rendimiento no lo incluye) — solo se muestra el ' +
        'peso teórico calculado, nunca inventado.',
      type: 'TELA',
      familyId: familyByCode.TELA,
      categoryId: categoryByCode['TELA-SMS'],
      grammage: 40,
      grammageUnit: 'g/m²',
      width: 2.1,
      widthUnit: 'm',
      length: 2800,
      lengthUnit: 'm',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 3,
    },
    {
      code: 'TELA-SMS-45',
      name: 'Tela PP SMS 45g',
      description:
        'Tela no tejida SMS 45g/m², rollo 2.1 x 2400 m. Iteración 12 — Rendimiento de ' +
        'Mandiles por Rollo de Tela, fuente: docs/rendimiento de mandiles.xlsx. Sin peso ' +
        'declarado de proveedor (la ficha de rendimiento no lo incluye) — solo se muestra el ' +
        'peso teórico calculado, nunca inventado.',
      type: 'TELA',
      familyId: familyByCode.TELA,
      categoryId: categoryByCode['TELA-SMS'],
      grammage: 45,
      grammageUnit: 'g/m²',
      width: 2.1,
      widthUnit: 'm',
      length: 2400,
      lengthUnit: 'm',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 3,
    },
    {
      code: 'LAM-AI-01',
      name: 'Laminado absorbente/impermeable',
      description: 'Laminado usado en fundas Mayo y refuerzos absorbentes.',
      type: 'LAMINADO',
      familyId: familyByCode.LAMINADO,
      categoryId: categoryByCode['LAM-ABS-IMP'],
      grammage: 55,
      grammageUnit: 'g/m²',
      color: 'Blanco',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 640,
    },
    {
      code: 'REF-UA-01',
      name: 'Refuerzo ultra-absorbente',
      description:
        'Refuerzo ultra-absorbente para zonas críticas de batas y campos reforzados. ' +
        'Supuesto demo: material creado para completar la composición del kit demo, sin ficha técnica de BIOSAFE.',
      type: 'REFUERZO',
      familyId: familyByCode.REFUERZO,
      categoryId: categoryByCode['REF-ULTRA-ABS'],
      grammage: 65,
      grammageUnit: 'g/m²',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 300,
    },
    {
      code: 'REF-SMS-01',
      name: 'Refuerzo SMS de mayor gramaje',
      description:
        'Capa adicional de tela SMS de mayor gramaje usada como refuerzo en pecho/mangas de ' +
        'batas y en fundas de mesa Mayo (caso PD GLOBAL 3CBIO01-179). ' +
        'Supuesto demo: material creado para completar la composición del kit demo, sin ficha técnica de BIOSAFE.',
      type: 'REFUERZO',
      familyId: familyByCode.REFUERZO,
      categoryId: categoryByCode['REF-SMS'],
      grammage: 70,
      grammageUnit: 'g/m²',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 260,
    },
    {
      code: 'PAP-ABS-01',
      name: 'Papel absorbente',
      description:
        'Papel absorbente para toallas y campos secantes. ' +
        'Supuesto demo: material creado para completar la composición del kit demo, sin ficha técnica de BIOSAFE.',
      type: 'PAPEL',
      familyId: familyByCode.PAPEL,
      categoryId: categoryByCode['PAP-ABSORBENTE'],
      grammage: 40,
      grammageUnit: 'g/m²',
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 500,
    },
    {
      code: 'TEJ-RIB-01',
      name: 'Tejido RIB para puños',
      description:
        'Tejido RIB de algodón/poliéster para puños de batas quirúrgicas. ' +
        'Supuesto demo: material creado para completar la composición del kit demo, sin ficha técnica de BIOSAFE.',
      type: 'CONFECCION',
      familyId: familyByCode.CONFECCION,
      categoryId: categoryByCode['CONF-PUNO'],
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 200,
    },
    {
      code: 'CIN-SMS-01',
      name: 'Cinta SMS para amarre',
      description:
        'Cinta SMS/polipropileno para tiras de amarre de batas y campos. ' +
        'Supuesto demo: material creado para completar la composición del kit demo, sin ficha técnica de BIOSAFE.',
      type: 'CINTA',
      familyId: familyByCode.CINTA,
      categoryId: categoryByCode['CIN-AMARRE'],
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 400,
    },
    {
      code: 'PAP-SIL-01',
      name: 'Papel removible siliconado',
      description:
        'Papel siliconado protector de la banda adhesiva, se retira antes del uso. ' +
        'Supuesto demo: material creado para completar la composición del kit demo, sin ficha técnica de BIOSAFE.',
      type: 'PAPEL',
      familyId: familyByCode.PAPEL,
      categoryId: categoryByCode['PAP-SILICONADO'],
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.RO,
      consumptionUnitId: unitByCode.MT,
      controlByDimensions: true,
      controlByLot: true,
      referenceStock: 400,
    },
    {
      code: 'CJ-STD-01',
      name: 'Caja estándar de despacho',
      description: 'Caja de cartón corrugado para despacho de producto terminado.',
      type: 'EMPAQUE',
      familyId: familyByCode.EMPAQUE,
      categoryId: categoryByCode['EMP-CAJA'],
      presentation: 'Unidad',
      purchaseUnitId: unitByCode.UN,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      referenceStock: 950,
    },
    {
      code: 'BOL-PE-01',
      name: 'Bolsa plástica de empaque',
      description: 'Bolsa de polietileno para empaque primario individual.',
      type: 'EMPAQUE',
      familyId: familyByCode.EMPAQUE,
      categoryId: categoryByCode['EMP-BOLSA'],
      presentation: 'Paquete x 500',
      purchaseUnitId: unitByCode.PQ,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      referenceStock: 12500,
    },
    {
      code: 'SOB-TYV-01',
      name: 'Sobre Tyvek para esterilización',
      description: 'Sobre de esterilización con indicador de proceso impreso.',
      type: 'EMPAQUE',
      familyId: familyByCode.EMPAQUE,
      categoryId: categoryByCode['EMP-SOBRE'],
      presentation: 'Caja x 200',
      purchaseUnitId: unitByCode.CJ,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      controlByLot: true,
      referenceStock: 3200,
    },
    {
      code: 'STK-BIO-01',
      name: 'Sticker Biosafe trazabilidad',
      description: 'Sticker de trazabilidad de lote para producto terminado.',
      type: 'ETIQUETADO',
      familyId: familyByCode.ETIQUETADO,
      categoryId: categoryByCode['ETQ-STICKER'],
      presentation: 'Rollo x 1000',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      referenceStock: 8600,
    },
    {
      code: 'IND-QCO-01',
      name: 'Indicador químico clase 1',
      description: 'Indicador químico de proceso para control de esterilización.',
      type: 'ETIQUETADO',
      familyId: familyByCode.ETIQUETADO,
      categoryId: categoryByCode['ETQ-INDICADOR'],
      presentation: 'Caja x 1000',
      purchaseUnitId: unitByCode.CJ,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      controlByLot: true,
      referenceStock: 4100,
    },
    {
      code: 'BATA-QX-STD',
      name: 'Bata quirúrgica estéril descartable',
      description: 'Bata quirúrgica estándar, gestionada hoy como materia prima.',
      type: 'CONFECCION',
      familyId: familyByCode.CONFECCION,
      categoryId: categoryByCode['CONF-BATA'],
      size: 'M/L/XL',
      presentation: 'Unidad',
      purchaseUnitId: unitByCode.UN,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      controlByLot: true,
      referenceStock: 3400,
    },
    {
      code: 'BATA-QX-REF',
      name: 'Bata quirúrgica reforzada estéril descartable',
      description: 'Bata quirúrgica con refuerzo SMS/SSMMS, gestionada como materia prima.',
      type: 'CONFECCION',
      familyId: familyByCode.CONFECCION,
      categoryId: categoryByCode['CONF-BATA'],
      size: 'M/L/XL',
      presentation: 'Unidad',
      purchaseUnitId: unitByCode.UN,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      controlByLot: true,
      referenceStock: 1250,
    },
    {
      code: 'MANGA-MIX-01',
      name: 'Manga mixta',
      description: 'Manga combinada tela/laminado, gestionada como materia prima.',
      type: 'CONFECCION',
      familyId: familyByCode.CONFECCION,
      categoryId: categoryByCode['CONF-MANGA'],
      presentation: 'Unidad',
      purchaseUnitId: unitByCode.UN,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      referenceStock: 980,
    },
    {
      code: 'MANGA-PLAS-01',
      name: 'Manga plástica',
      description: 'Manga plástica impermeable, gestionada como materia prima.',
      type: 'CONFECCION',
      familyId: familyByCode.CONFECCION,
      categoryId: categoryByCode['CONF-MANGA'],
      presentation: 'Unidad',
      purchaseUnitId: unitByCode.UN,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      referenceStock: 760,
    },
    {
      code: 'PUNO-EL-01',
      name: 'Puño elástico',
      description: 'Puño elástico tejido para batas y mangas.',
      type: 'CONFECCION',
      familyId: familyByCode.CONFECCION,
      categoryId: categoryByCode['CONF-PUNO'],
      presentation: 'Paquete x 100',
      purchaseUnitId: unitByCode.PQ,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      referenceStock: 2200,
    },
    {
      code: 'ENV-EST-01',
      name: 'Envoltorio estéril para kit',
      description: 'Envoltorio grado médico usado para envolver kits completos antes de esterilizar.',
      type: 'EMPAQUE',
      familyId: familyByCode.EMPAQUE,
      categoryId: categoryByCode['EMP-SOBRE'],
      presentation: 'Rollo',
      purchaseUnitId: unitByCode.RO,
      inventoryUnitId: unitByCode.UN,
      consumptionUnitId: unitByCode.UN,
      controlByUnit: true,
      controlByLot: true,
      referenceStock: 1800,
    },
  ]

  for (const material of materials) {
    await prisma.rawMaterial.upsert({
      where: { code: material.code },
      update: material,
      create: material,
    })
  }
}

async function seedRoutes() {
  const routes = [
    {
      code: 'F01',
      name: 'Individual estéril',
      description:
        'Materia prima → Control de calidad → Almacén → Requerimiento → Abastecimiento → ' +
        'Corte → Costura → Empaque → Esterilización → Control de calidad → Producto terminado.',
    },
    {
      code: 'F02',
      name: 'Individual aséptico',
      description: 'Ruta corta que termina en Empaque, sin paso de esterilización.',
    },
  ]

  for (const route of routes) {
    await prisma.route.upsert({
      where: { code: route.code },
      update: route,
      create: route,
    })
  }
}

async function seedRouteSteps() {
  const routeByCode = Object.fromEntries((await prisma.route.findMany()).map((r) => [r.code, r.id]))

  // Línea de producción física por paso (Iteración 10, sección E). Solo se
  // asigna a los pasos operativos de planta; los administrativos (MP,
  // control de calidad de MP, almacén, requerimiento, abastecimiento)
  // quedan sin línea — no se inventa una línea física para un trámite.
  const stepsByRoute: Record<
    string,
    { code: string; name: string; sequence: number; productionLine?: string }[]
  > = {
    F01: [
      { code: 'MP', name: 'Materia prima', sequence: 1 },
      { code: 'CC-MP', name: 'Control de calidad MP', sequence: 2 },
      { code: 'ALM-MP', name: 'Almacén materia prima', sequence: 3 },
      { code: 'REQ', name: 'Requerimiento de material', sequence: 4 },
      { code: 'ABAST', name: 'Abastecimiento', sequence: 5 },
      { code: 'CORTE', name: 'Corte', sequence: 6, productionLine: 'Corte' },
      { code: 'COSTURA', name: 'Costura', sequence: 7, productionLine: 'Costura' },
      { code: 'EMPAQUE', name: 'Empaque', sequence: 8, productionLine: 'Empaque' },
      { code: 'ESTERIL', name: 'Esterilización', sequence: 9, productionLine: 'Esterilización' },
      { code: 'CC-FINAL', name: 'Control de calidad final', sequence: 10, productionLine: 'Calidad' },
      { code: 'PT', name: 'Producto terminado', sequence: 11, productionLine: 'Calidad' },
    ],
    F02: [
      { code: 'MP', name: 'Materia prima', sequence: 1 },
      { code: 'CC-MP', name: 'Control de calidad MP', sequence: 2 },
      { code: 'ALM-MP', name: 'Almacén materia prima', sequence: 3 },
      { code: 'REQ', name: 'Requerimiento de material', sequence: 4 },
      { code: 'ABAST', name: 'Abastecimiento', sequence: 5 },
      { code: 'CORTE', name: 'Corte', sequence: 6, productionLine: 'Corte' },
      { code: 'COSTURA', name: 'Costura', sequence: 7, productionLine: 'Costura' },
      { code: 'EMPAQUE', name: 'Empaque', sequence: 8, productionLine: 'Empaque' },
      { code: 'PT', name: 'Producto terminado', sequence: 9, productionLine: 'Calidad' },
    ],
  }

  for (const [routeCode, steps] of Object.entries(stepsByRoute)) {
    const routeId = routeByCode[routeCode]
    for (const step of steps) {
      await prisma.routeStep.upsert({
        where: { routeId_sequence: { routeId, sequence: step.sequence } },
        update: { code: step.code, name: step.name, active: true, productionLine: step.productionLine },
        create: {
          routeId,
          code: step.code,
          name: step.name,
          sequence: step.sequence,
          productionLine: step.productionLine,
        },
      })
    }
  }
}

async function seedProductFamiliesAndCategories() {
  const families = [
    {
      code: 'CAMPOS',
      name: 'Campos quirúrgicos',
      description: 'Campos simples, fenestrados y reforzados.',
      categories: [
        { code: 'CAMPO-SIMPLE', name: 'Campo simple' },
        { code: 'CAMPO-FENESTRADO', name: 'Campo fenestrado' },
      ],
    },
    {
      code: 'ROPA_QUIRURGICA',
      name: 'Ropa quirúrgica',
      description: 'Batas y mandiles quirúrgicos por talla.',
      categories: [{ code: 'MANDIL-BATA', name: 'Mandil / Bata' }],
    },
    {
      code: 'SABANAS',
      name: 'Sábanas quirúrgicas',
      description: 'Sábanas estériles descartables.',
      categories: [{ code: 'SABANA-ESTANDAR', name: 'Sábana estándar' }],
    },
    {
      code: 'KITS',
      name: 'Kits quirúrgicos',
      description: 'Kits compuestos por varios productos individuales.',
      categories: [{ code: 'KIT-ROPA', name: 'Kit de ropa quirúrgica' }],
    },
    {
      code: 'ACCESORIOS',
      name: 'Accesorios quirúrgicos',
      description: 'Fundas, ponchos, toallas y otros accesorios que integran kits.',
      categories: [
        { code: 'ACC-TOALLA', name: 'Toalla' },
        { code: 'ACC-FUNDA', name: 'Funda' },
        { code: 'ACC-PONCHO', name: 'Poncho' },
      ],
    },
  ]

  for (const family of families) {
    const createdFamily = await prisma.productFamily.upsert({
      where: { code: family.code },
      update: { name: family.name, description: family.description },
      create: { code: family.code, name: family.name, description: family.description },
    })

    for (const category of family.categories) {
      await prisma.productCategory.upsert({
        where: { code: category.code },
        update: { name: category.name, familyId: createdFamily.id },
        create: { code: category.code, name: category.name, familyId: createdFamily.id },
      })
    }
  }
}

async function seedProducts() {
  const familyByCode = Object.fromEntries(
    (await prisma.productFamily.findMany()).map((f) => [f.code, f.id]),
  )
  const categoryByCode = Object.fromEntries(
    (await prisma.productCategory.findMany()).map((c) => [c.code, c.id]),
  )
  const routeByCode = Object.fromEntries((await prisma.route.findMany()).map((r) => [r.code, r.id]))

  const products = [
    {
      code: 'PT-CQE-0012',
      name: 'Campo quirúrgico con adhesivo estéril descartable 90x90 cm',
      description: 'Campo quirúrgico simple, con banda adhesiva, estéril y descartable.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.CAMPOS,
      categoryId: categoryByCode['CAMPO-SIMPLE'],
      presentation: 'Unidad',
      width: 90,
      length: 90,
      grammage: 35,
      sterile: true,
      usesAdhesive: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-CQF-0008',
      name: 'Campo quirúrgico fenestrado con adhesivo estéril descartable 90x90 cm',
      description: 'Campo quirúrgico con fenestra central, banda adhesiva, estéril y descartable.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.CAMPOS,
      categoryId: categoryByCode['CAMPO-FENESTRADO'],
      presentation: 'Unidad',
      width: 90,
      length: 90,
      grammage: 35,
      sterile: true,
      fenestrated: true,
      usesAdhesive: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-SQE-0005',
      name: 'Sábana quirúrgica estéril descartable 200x150 cm',
      description: 'Sábana quirúrgica estéril y descartable para mesa de operaciones.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.SABANAS,
      categoryId: categoryByCode['SABANA-ESTANDAR'],
      presentation: 'Unidad',
      width: 150,
      length: 200,
      grammage: 35,
      sterile: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      // Iteración 12 — Rendimiento de Mandiles por Rollo de Tela: talla S
      // no existía en el maestro. Se mantiene la configuración de M/L/XL
      // sin tocarlas (regla explícita del pedido).
      code: 'PT-MQS-0001',
      name: 'Mandil / bata quirúrgica estéril descartable talla S',
      description: 'Bata quirúrgica estéril descartable, talla S.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ROPA_QUIRURGICA,
      categoryId: categoryByCode['MANDIL-BATA'],
      presentation: 'Unidad',
      size: 'S',
      grammage: 35,
      sterile: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-MQM-0002',
      name: 'Mandil / bata quirúrgica estéril descartable talla M',
      description: 'Bata quirúrgica estéril descartable, talla M.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ROPA_QUIRURGICA,
      categoryId: categoryByCode['MANDIL-BATA'],
      presentation: 'Unidad',
      size: 'M',
      grammage: 35,
      sterile: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-MQL-0003',
      name: 'Mandil / bata quirúrgica estéril descartable talla L',
      description: 'Bata quirúrgica estéril descartable, talla L.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ROPA_QUIRURGICA,
      categoryId: categoryByCode['MANDIL-BATA'],
      presentation: 'Unidad',
      size: 'L',
      grammage: 35,
      sterile: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-MQX-0004',
      name: 'Mandil / bata quirúrgica estéril descartable talla XL',
      description: 'Bata quirúrgica estéril descartable, talla XL.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ROPA_QUIRURGICA,
      categoryId: categoryByCode['MANDIL-BATA'],
      presentation: 'Unidad',
      size: 'XL',
      grammage: 35,
      sterile: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-TOA-0001',
      name: 'Toalla quirúrgica estéril descartable',
      description: 'Toalla absorbente para secado de manos en campo estéril.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ACCESORIOS,
      categoryId: categoryByCode['ACC-TOALLA'],
      presentation: 'Unidad',
      sterile: true,
      usesLabel: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-FMA-0001',
      name: 'Funda Mayo estéril descartable',
      description: 'Funda laminada para mesa Mayo, impermeable.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ACCESORIOS,
      categoryId: categoryByCode['ACC-FUNDA'],
      presentation: 'Unidad',
      sterile: true,
      laminated: true,
      usesLabel: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-FML-0001',
      name: 'Funda media luna estéril descartable',
      description: 'Funda semicircular para mesa de instrumental.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ACCESORIOS,
      categoryId: categoryByCode['ACC-FUNDA'],
      presentation: 'Unidad',
      sterile: true,
      usesLabel: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-PON-0001',
      name: 'Poncho quirúrgico estéril descartable',
      description: 'Poncho impermeable para el equipo quirúrgico.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ACCESORIOS,
      categoryId: categoryByCode['ACC-PONCHO'],
      presentation: 'Unidad',
      sterile: true,
      laminated: true,
      usesLabel: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-CQR-0001',
      name: 'Campo quirúrgico reforzado estéril descartable 90x90 cm',
      description: 'Campo quirúrgico con refuerzo absorbente adicional en zona central.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.CAMPOS,
      categoryId: categoryByCode['CAMPO-SIMPLE'],
      presentation: 'Unidad',
      width: 90,
      length: 90,
      grammage: 45,
      sterile: true,
      reinforced: true,
      usesAdhesive: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-CQA-0099',
      name: 'Campo quirúrgico aséptico descartable 90x90 cm',
      description:
        'Campo quirúrgico simple, empaque en ambiente controlado sin ciclo de ' +
        'esterilización adicional — ruta F02 (individual aséptico).',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.CAMPOS,
      categoryId: categoryByCode['CAMPO-SIMPLE'],
      presentation: 'Unidad',
      width: 90,
      length: 90,
      grammage: 35,
      sterile: false,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F02,
    },
    {
      code: 'PT-KRQ-0016',
      name: 'Kit de ropa quirúrgica x 16 estéril descartable',
      description:
        'Kit compuesto por mandiles, toallas, campos, sábanas, funda Mayo, funda media ' +
        'luna y poncho. Composición detallada en el módulo Composición / BOM.',
      productType: 'KIT' as const,
      familyId: familyByCode.KITS,
      categoryId: categoryByCode['KIT-ROPA'],
      presentation: 'Kit',
      sterile: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },

    // ---------------------------------------------------------------------
    // Caso demo PD GLOBAL — Cotización 3CBIO01-179, Kit de laparotomía
    // estéril descartable x 13 piezas. Configuraciones propias (refuerzo,
    // toalla integrada, adhesivo, fenestra con bolsillos) distintas de los
    // productos genéricos ya sembrados: se crean con código propio en vez
    // de reutilizar/editar los existentes (regla del maestro: "el mismo
    // número de piezas no define un kit" / cada configuración es un
    // producto propio). El campo con adhesivo 90x90 sí es idéntico al ya
    // sembrado PT-CQE-0012, así que la BOM del kit lo reutiliza en vez de
    // duplicarlo.
    // ---------------------------------------------------------------------
    {
      code: 'PT-BRT-0001',
      name: 'Bata quirúrgica reforzada con toalla talla L estéril descartable',
      description:
        'Bata quirúrgica 125 x 155 cm, con refuerzo SMS en pecho y mangas (termosellado), ' +
        'toalla de mano de 20 x 40 cm integrada y mangas ranglan. Cotización 3CBIO01-179 — ' +
        'kit de laparotomía PD GLOBAL / AVIVA.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ROPA_QUIRURGICA,
      categoryId: categoryByCode['MANDIL-BATA'],
      presentation: 'Unidad',
      size: 'L',
      width: 125,
      length: 155,
      grammage: 40,
      sterile: true,
      reinforced: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-FMR-0001',
      name: 'Funda para mesa Mayo reforzada estéril descartable 70x120 cm',
      description:
        'Funda para mesa Mayo 70 x 120 cm, con refuerzo SMS y laminado de 60 g/m². ' +
        'Cotización 3CBIO01-179 — kit de laparotomía PD GLOBAL / AVIVA.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ACCESORIOS,
      categoryId: categoryByCode['ACC-FUNDA'],
      presentation: 'Unidad',
      width: 70,
      length: 120,
      grammage: 60,
      sterile: true,
      reinforced: true,
      laminated: true,
      usesLabel: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-SQA-0001',
      name: 'Sábana quirúrgica con adhesivo estéril descartable 200x150 cm',
      description:
        'Sábana quirúrgica 200 x 150 cm, con banda adhesiva de 1.8 x 80 cm por el lado de ' +
        '200 cm. Cotización 3CBIO01-179 — kit de laparotomía PD GLOBAL / AVIVA. Distinta de ' +
        'PT-SQE-0005 (sin adhesivo) para no alterar un producto ya usado en otro caso demo.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.SABANAS,
      categoryId: categoryByCode['SABANA-ESTANDAR'],
      presentation: 'Unidad',
      width: 150,
      length: 200,
      grammage: 40,
      sterile: true,
      usesAdhesive: true,
      usesLabel: true,
      usesBag: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-PQF-0001',
      name: 'Poncho quirúrgico fenestrado con bolsillos estéril descartable',
      description:
        'Poncho quirúrgico 200 x 150 cm, fenestra de 21 x 31 cm con adhesivo alrededor, dos ' +
        'bolsillos laterales de 30 x 40 cm junto a la fenestra, termosellado. Cotización ' +
        '3CBIO01-179 — kit de laparotomía PD GLOBAL / AVIVA.',
      productType: 'INDIVIDUAL' as const,
      familyId: familyByCode.ACCESORIOS,
      categoryId: categoryByCode['ACC-PONCHO'],
      presentation: 'Unidad',
      width: 150,
      length: 200,
      grammage: 40,
      sterile: true,
      fenestrated: true,
      laminated: true,
      usesAdhesive: true,
      usesLabel: true,
      routeId: routeByCode.F01,
    },
    {
      code: 'PT-KLP-0001',
      name: 'Kit de laparotomía estéril descartable x 13 piezas',
      description:
        'Cotización 3CBIO01-179 — PD GLOBAL / AVIVA. 12 componentes producto (4 batas, 1 ' +
        'funda Mayo, 4 campos, 2 sábanas, 1 poncho) + 1 indicador químico = 13 piezas ' +
        'comerciales. El envoltorio es material de empaque y no cuenta como pieza. ' +
        'Composición detallada en el módulo Composición / BOM.',
      productType: 'KIT' as const,
      familyId: familyByCode.KITS,
      categoryId: categoryByCode['KIT-ROPA'],
      presentation: 'Kit',
      grammage: 40,
      sterile: true,
      usesLabel: true,
      routeId: routeByCode.F01,
    },
  ]

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: product,
      create: product,
    })
  }
}

interface SeedBomItem {
  componentType: 'RAW_MATERIAL' | 'PRODUCT'
  componentClass: 'PRODUCTIVE_MATERIAL' | 'PACKAGING_MATERIAL'
  rawMaterialCode?: string
  componentProductCode?: string
  quantity: number
  unit: string
  wastePercentage?: number
  requiredWidth?: number
  requiredLength?: number
  notes?: string
  sequence: number
  required?: boolean
  // "13 piezas comerciales" (caso PD GLOBAL 3CBIO01-179): por defecto true
  // para PRODUCT y false para RAW_MATERIAL — igual que el default del
  // schema/servicio — pero editable por ítem (p.ej. un indicador químico
  // RAW_MATERIAL puede ser true).
  countsTowardKitPieces?: boolean
}

async function upsertBom(productCode: string, notes: string, items: SeedBomItem[]) {
  const product = await prisma.product.findUniqueOrThrow({ where: { code: productCode } })
  const rawMaterialByCode = Object.fromEntries(
    (await prisma.rawMaterial.findMany()).map((m) => [m.code, m.id]),
  )
  const productByCode = Object.fromEntries(
    (await prisma.product.findMany()).map((p) => [p.code, p.id]),
  )

  const header = await prisma.bomHeader.upsert({
    where: { productId: product.id },
    update: { notes, active: true },
    create: { productId: product.id, notes, active: true },
  })

  await prisma.bomItem.deleteMany({ where: { bomHeaderId: header.id } })

  await prisma.bomItem.createMany({
    data: items.map((item) => ({
      bomHeaderId: header.id,
      componentType: item.componentType,
      componentClass: item.componentClass,
      rawMaterialId: item.rawMaterialCode ? rawMaterialByCode[item.rawMaterialCode] : undefined,
      componentProductId: item.componentProductCode
        ? productByCode[item.componentProductCode]
        : undefined,
      quantity: item.quantity,
      unit: item.unit,
      wastePercentage: item.wastePercentage,
      requiredWidth: item.requiredWidth,
      requiredLength: item.requiredLength,
      notes: item.notes,
      sequence: item.sequence,
      required: item.required ?? true,
      countsTowardKitPieces: item.countsTowardKitPieces ?? item.componentType === 'PRODUCT',
    })),
  })
}

async function seedBom() {
  await upsertBom(
    'PT-CQE-0012',
    'BOM demo: campo quirúrgico con adhesivo 90x90.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 0.9,
        unit: 'm',
        wastePercentage: 5,
        requiredWidth: 0.9,
        requiredLength: 0.9,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'AD-1850',
        quantity: 0.7,
        unit: 'm',
        wastePercentage: 3,
        requiredLength: 0.7,
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'PAP-SIL-01',
        quantity: 0.7,
        unit: 'm',
        notes: 'Supuesto demo: papel removible que protege la banda adhesiva, sin ficha técnica.',
        sequence: 3,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'SOB-TYV-01',
        quantity: 1,
        unit: 'un',
        sequence: 4,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 5,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'CJ-STD-01',
        quantity: 0.025,
        unit: 'un',
        notes: 'Aprox. 1 caja cada 40 unidades despachadas.',
        required: false,
        sequence: 6,
      },
    ],
  )

  await upsertBom(
    'PT-MQS-0001',
    'BOM demo: mandil / bata quirúrgica talla S — cuerpo SMS, puños RIB y tiras de amarre SMS.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 1.0,
        unit: 'm',
        wastePercentage: 5,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TEJ-RIB-01',
        quantity: 0.12,
        unit: 'm',
        notes: 'Supuesto demo: consumo de puños RIB por unidad, sin ficha técnica.',
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'CIN-SMS-01',
        quantity: 0.5,
        unit: 'm',
        notes: 'Supuesto demo: tiras de amarre por unidad, sin ficha técnica.',
        sequence: 3,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'SOB-TYV-01',
        quantity: 1,
        unit: 'un',
        sequence: 4,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 5,
      },
    ],
  )

  await upsertBom(
    'PT-MQL-0003',
    'BOM demo: mandil / bata quirúrgica talla L — cuerpo SMS, puños RIB y tiras de amarre SMS.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 1.2,
        unit: 'm',
        wastePercentage: 5,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TEJ-RIB-01',
        quantity: 0.15,
        unit: 'm',
        notes: 'Supuesto demo: consumo de puños RIB por unidad, sin ficha técnica.',
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'CIN-SMS-01',
        quantity: 0.6,
        unit: 'm',
        notes: 'Supuesto demo: tiras de amarre por unidad, sin ficha técnica.',
        sequence: 3,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'SOB-TYV-01',
        quantity: 1,
        unit: 'un',
        sequence: 4,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 5,
      },
    ],
  )

  await upsertBom(
    'PT-TOA-0001',
    'BOM demo: toalla quirúrgica — papel absorbente.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'PAP-ABS-01',
        quantity: 0.3,
        unit: 'm',
        notes: 'Supuesto demo: consumo de papel absorbente por unidad, sin ficha técnica.',
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 2,
      },
    ],
  )

  await upsertBom(
    'PT-FMA-0001',
    'BOM demo: funda para mesa Mayo — laminado absorbente/impermeable con refuerzo SMS.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'LAM-AI-01',
        quantity: 1.0,
        unit: 'm',
        notes: 'Supuesto demo: consumo de laminado por unidad, sin ficha técnica.',
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 0.5,
        unit: 'm',
        notes: 'Supuesto demo: SMS combinado con el laminado, sin ficha técnica.',
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 3,
      },
    ],
  )

  await upsertBom(
    'PT-FML-0001',
    'BOM demo: funda para mesa media luna — SMS con franja de laminado.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 0.7,
        unit: 'm',
        notes: 'Supuesto demo: consumo de SMS por unidad, sin ficha técnica.',
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'LAM-AI-01',
        quantity: 0.3,
        unit: 'm',
        notes: 'Supuesto demo: franja de laminado absorbente/impermeable, sin ficha técnica.',
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 3,
      },
    ],
  )

  await upsertBom(
    'PT-PON-0001',
    'BOM demo: poncho quirúrgico — SMS con laminado impermeable.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 1.5,
        unit: 'm',
        notes: 'Supuesto demo: consumo de SMS por unidad, sin ficha técnica.',
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'LAM-AI-01',
        quantity: 0.4,
        unit: 'm',
        notes: 'Supuesto demo: laminado impermeable, sin ficha técnica.',
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 3,
      },
    ],
  )

  await upsertBom(
    'PT-CQR-0001',
    'BOM demo: campo quirúrgico reforzado 90x90 — SMS, refuerzo ultra-absorbente y adhesivo médico.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 0.9,
        unit: 'm',
        wastePercentage: 5,
        requiredWidth: 0.9,
        requiredLength: 0.9,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'REF-UA-01',
        quantity: 0.3,
        unit: 'm',
        notes: 'Supuesto demo: refuerzo ultra-absorbente en zona central, sin ficha técnica.',
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'AD-1850',
        quantity: 0.7,
        unit: 'm',
        wastePercentage: 3,
        notes: 'Supuesto demo: banda adhesiva médica, sin ficha técnica.',
        sequence: 3,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'PAP-SIL-01',
        quantity: 0.7,
        unit: 'm',
        notes: 'Supuesto demo: papel removible que protege la banda adhesiva, sin ficha técnica.',
        sequence: 4,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'SOB-TYV-01',
        quantity: 1,
        unit: 'un',
        sequence: 5,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 6,
      },
    ],
  )

  await upsertBom(
    'PT-SQE-0005',
    'BOM demo: sábana quirúrgica 200x150.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 2.2,
        unit: 'm',
        wastePercentage: 5,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'BOL-PE-01',
        quantity: 1,
        unit: 'un',
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 3,
      },
    ],
  )

  // Caso demo principal (sección 50): Kit de ropa quirúrgica x 16, Clínica
  // Unión, lote I-2110185EK, 250 kits.
  await upsertBom(
    'PT-KRQ-0016',
    'BOM demo: Kit de ropa quirúrgica x 16 — caso Clínica Unión.',
    [
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-MQL-0003',
        quantity: 3,
        unit: 'un',
        sequence: 1,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-TOA-0001',
        quantity: 3,
        unit: 'un',
        sequence: 2,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-FMA-0001',
        quantity: 1,
        unit: 'un',
        sequence: 3,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-CQR-0001',
        quantity: 1,
        unit: 'un',
        sequence: 4,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-FML-0001',
        quantity: 1,
        unit: 'un',
        sequence: 5,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-PON-0001',
        quantity: 1,
        unit: 'un',
        sequence: 6,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-SQE-0005',
        quantity: 2,
        unit: 'un',
        sequence: 7,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-CQE-0012',
        quantity: 4,
        unit: 'un',
        sequence: 8,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'ENV-EST-01',
        quantity: 1,
        unit: 'un',
        sequence: 9,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'IND-QCO-01',
        quantity: 1,
        unit: 'un',
        notes: 'Indicador interno de esterilización.',
        sequence: 10,
      },
    ],
  )

  await upsertBom(
    'PT-CQA-0099',
    'BOM demo: campo quirúrgico aséptico 90x90 — ruta F02, sin esterilización.',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 0.85,
        unit: 'm',
        wastePercentage: 5,
        requiredWidth: 0.9,
        requiredLength: 0.9,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'BOL-PE-01',
        quantity: 1,
        unit: 'un',
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 3,
      },
    ],
  )

  // -------------------------------------------------------------------
  // Caso demo PD GLOBAL — Cotización 3CBIO01-179, Kit de laparotomía x 13
  // piezas. Consumos técnicos exactos no disponibles: se usan valores
  // demo razonables, cada uno marcado en `notes` como supuesto pendiente
  // de ficha técnica (nunca presentados como dato oficial).
  // -------------------------------------------------------------------
  const LAPAROTOMIA_ASSUMPTION =
    'Supuesto demo basado en cotización 3CBIO01-179; pendiente de ficha técnica.'

  await upsertBom(
    'PT-BRT-0001',
    'BOM demo: bata quirúrgica reforzada con toalla talla L — cotización 3CBIO01-179 (PD GLOBAL).',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 1.4,
        unit: 'm',
        wastePercentage: 5,
        notes: LAPAROTOMIA_ASSUMPTION,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'REF-SMS-01',
        quantity: 0.5,
        unit: 'm',
        notes: `Refuerzo SMS en pecho y mangas (termosellado). ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'PAP-ABS-01',
        quantity: 0.3,
        unit: 'm',
        notes: `Toalla de mano de 20 x 40 cm integrada. ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 3,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TEJ-RIB-01',
        quantity: 0.15,
        unit: 'm',
        notes: `Puños. ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 4,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'CIN-SMS-01',
        quantity: 0.6,
        unit: 'm',
        notes: `Tiras de amarre / mangas ranglan. ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 5,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'SOB-TYV-01',
        quantity: 1,
        unit: 'un',
        sequence: 6,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 7,
      },
    ],
  )

  await upsertBom(
    'PT-FMR-0001',
    'BOM demo: funda para mesa Mayo reforzada 70x120 — cotización 3CBIO01-179 (PD GLOBAL).',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'LAM-AI-01',
        quantity: 1.0,
        unit: 'm',
        notes: `Laminado de 60 g/m² (catálogo actual: 55 g/m², gramaje más cercano disponible). ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'REF-SMS-01',
        quantity: 0.4,
        unit: 'm',
        notes: LAPAROTOMIA_ASSUMPTION,
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 3,
      },
    ],
  )

  await upsertBom(
    'PT-SQA-0001',
    'BOM demo: sábana quirúrgica con adhesivo 200x150 — cotización 3CBIO01-179 (PD GLOBAL).',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 2.2,
        unit: 'm',
        wastePercentage: 5,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'AD-1850',
        quantity: 0.8,
        unit: 'm',
        wastePercentage: 3,
        notes: `Banda adhesiva de 1.8 x 80 cm por el lado de 200 cm. ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'PAP-SIL-01',
        quantity: 0.8,
        unit: 'm',
        notes: `Papel removible que protege la banda adhesiva. ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 3,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'BOL-PE-01',
        quantity: 1,
        unit: 'un',
        sequence: 4,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 5,
      },
    ],
  )

  await upsertBom(
    'PT-PQF-0001',
    'BOM demo: poncho quirúrgico fenestrado con bolsillos — cotización 3CBIO01-179 (PD GLOBAL).',
    [
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'TELA-SMS-35',
        quantity: 1.6,
        unit: 'm',
        wastePercentage: 5,
        notes: `Cuerpo del poncho, incluye tela de los 2 bolsillos laterales de 30 x 40 cm. ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 1,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'LAM-AI-01',
        quantity: 0.4,
        unit: 'm',
        notes: `Laminado impermeable. ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 2,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'AD-1850',
        quantity: 0.9,
        unit: 'm',
        wastePercentage: 3,
        notes: `Adhesivo alrededor de la fenestra de 21 x 31 cm. ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 3,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PRODUCTIVE_MATERIAL',
        rawMaterialCode: 'PAP-SIL-01',
        quantity: 0.9,
        unit: 'm',
        notes: `Papel removible que protege la banda adhesiva. ${LAPAROTOMIA_ASSUMPTION}`,
        sequence: 4,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'SOB-TYV-01',
        quantity: 1,
        unit: 'un',
        sequence: 5,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'STK-BIO-01',
        quantity: 1,
        unit: 'un',
        sequence: 6,
      },
    ],
  )

  // Kit de laparotomía x 13 piezas comerciales: 12 componentes producto
  // (4 batas + 1 funda Mayo + 4 campos + 2 sábanas + 1 poncho) + 1
  // indicador químico (RAW_MATERIAL, countsTowardKitPieces=true por
  // excepción) = 13. El envoltorio es material de empaque y no cuenta
  // (countsTowardKitPieces=false). El campo con adhesivo 90x90 reutiliza
  // el producto ya sembrado PT-CQE-0012 (misma configuración exacta).
  await upsertBom(
    'PT-KLP-0001',
    'BOM demo: Kit de laparotomía x 13 piezas — cotización 3CBIO01-179 (PD GLOBAL / AVIVA).',
    [
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-BRT-0001',
        quantity: 4,
        unit: 'un',
        sequence: 1,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-FMR-0001',
        quantity: 1,
        unit: 'un',
        sequence: 2,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-CQE-0012',
        quantity: 4,
        unit: 'un',
        notes: 'Campo con adhesivo 90x90 — mismo producto ya usado en otros kits/cotizaciones.',
        sequence: 3,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-SQA-0001',
        quantity: 2,
        unit: 'un',
        sequence: 4,
      },
      {
        componentType: 'PRODUCT',
        componentClass: 'PRODUCTIVE_MATERIAL',
        componentProductCode: 'PT-PQF-0001',
        quantity: 1,
        unit: 'un',
        sequence: 5,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'IND-QCO-01',
        quantity: 1,
        unit: 'un',
        notes: 'Indicador químico interno: en este kit SÍ cuenta como pieza comercial (13a pieza).',
        countsTowardKitPieces: true,
        sequence: 6,
      },
      {
        componentType: 'RAW_MATERIAL',
        componentClass: 'PACKAGING_MATERIAL',
        rawMaterialCode: 'ENV-EST-01',
        quantity: 1,
        unit: 'un',
        notes: 'Envoltorio 210x150cm laminado 60 g/m² — material de empaque, no cuenta como pieza comercial.',
        countsTowardKitPieces: false,
        sequence: 7,
      },
    ],
  )
}

interface ConsolidatedMaterial {
  rawMaterialId: number
  componentClass: 'PRODUCTIVE_MATERIAL' | 'PACKAGING_MATERIAL'
  unit: string
  totalRequired: number
  totalRequiredWithWaste: number
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

/**
 * Réplica autocontenida (usa el cliente Prisma del propio seed) de la
 * explosión multinivel de `backend/src/modules/bom/bom.service.ts`, para no
 * acoplar el script de seed a módulos del backend que asumen su propio
 * cliente Prisma / contexto de Express.
 */
async function explodeMaterialsMultiLevel(productId: number, quantity: number) {
  const accumulator = new Map<string, ConsolidatedMaterial>()

  async function walk(currentProductId: number, multiplier: number, path: Set<number>) {
    if (path.has(currentProductId)) return
    path.add(currentProductId)

    const header = await prisma.bomHeader.findUnique({
      where: { productId: currentProductId },
      include: { items: true },
    })

    if (header) {
      for (const item of header.items) {
        const itemQuantity = multiplier * Number(item.quantity)

        if (item.componentType === 'RAW_MATERIAL' && item.rawMaterialId) {
          const waste = item.wastePercentage ? Number(item.wastePercentage) : 0
          const withWaste = waste > 0 ? itemQuantity * (1 + waste / 100) : itemQuantity
          const key = `${item.rawMaterialId}-${item.componentClass}`

          const existing = accumulator.get(key)
          if (existing) {
            existing.totalRequired += itemQuantity
            existing.totalRequiredWithWaste += withWaste
          } else {
            accumulator.set(key, {
              rawMaterialId: item.rawMaterialId,
              componentClass: item.componentClass,
              unit: item.unit,
              totalRequired: itemQuantity,
              totalRequiredWithWaste: withWaste,
            })
          }
        } else if (item.componentType === 'PRODUCT' && item.componentProductId) {
          await walk(item.componentProductId, itemQuantity, path)
        }
      }
    }

    path.delete(currentProductId)
  }

  await walk(productId, quantity, new Set())

  return Array.from(accumulator.values()).map((entry) => ({
    ...entry,
    totalRequired: round4(entry.totalRequired),
    totalRequiredWithWaste: round4(entry.totalRequiredWithWaste),
  }))
}

async function seedCustomers() {
  const customers = [
    'CLÍNICA UNIÓN',
    'FALDO',
    'PROSEMEDIC',
    'DROFAR',
    'UTILITARIOS',
    'PD GLOBAL',
    'ANGLOMED',
  ]

  for (const name of customers) {
    await prisma.customer.upsert({ where: { name }, update: {}, create: { name } })
  }
}

interface QuoteItemSeed {
  productCode: string
  quantity: number
  // Snapshot comercial opcional de ESTE ítem de cotización (nunca se
  // copia al maestro de Producto/Materia Prima).
  unitCostWithTax?: number
  unitCostWithoutTax?: number
  marginPercentage?: number
  unitPriceWithTax?: number
}

async function upsertQuote(
  code: string,
  customerName: string,
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED',
  items: QuoteItemSeed[],
  notes?: string,
) {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { name: customerName } })

  const quote = await prisma.quote.upsert({
    where: { code },
    update: { status, customerId: customer.id, notes },
    create: { code, customerId: customer.id, status, notes },
  })

  await prisma.quoteItem.deleteMany({ where: { quoteId: quote.id } })

  for (const [index, item] of items.entries()) {
    const product = await prisma.product.findUniqueOrThrow({ where: { code: item.productCode } })
    await prisma.quoteItem.create({
      data: {
        quoteId: quote.id,
        productId: product.id,
        quantity: item.quantity,
        unitCostWithTax: item.unitCostWithTax,
        unitCostWithoutTax: item.unitCostWithoutTax,
        marginPercentage: item.marginPercentage,
        unitPriceWithTax: item.unitPriceWithTax,
        sequence: index + 1,
      },
    })
  }

  return quote
}

async function upsertOrderFromQuote(
  orderCode: string,
  quote: { id: number; customerId: number },
  status: 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED' | 'CANCELLED',
  purchaseOrderNumber?: string,
) {
  const quoteItems = await prisma.quoteItem.findMany({ where: { quoteId: quote.id } })

  const order = await prisma.order.upsert({
    where: { code: orderCode },
    update: { status, customerId: quote.customerId, quoteId: quote.id, purchaseOrderNumber },
    create: {
      code: orderCode,
      customerId: quote.customerId,
      quoteId: quote.id,
      status,
      purchaseOrderNumber,
    },
  })

  const existingItems = await prisma.orderItem.findMany({ where: { orderId: order.id } })
  if (existingItems.length === 0) {
    for (const [index, item] of quoteItems.entries()) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          sequence: index + 1,
        },
      })
    }
  }

  return order
}

/**
 * Caso demo principal (sección 50): Clínica Unión, Kit de ropa quirúrgica
 * x 16, lote I-2110185EK, 250 kits, pedido aprobado con Lote + OP generados
 * y materia prima consolidada por explosión multinivel.
 */
async function seedMainDemoCase() {
  const quote = await upsertQuote(
    'COT-0001',
    'CLÍNICA UNIÓN',
    'APPROVED',
    [{ productCode: 'PT-KRQ-0016', quantity: 250 }],
    'Caso demo principal — Kit de ropa quirúrgica x 16 estéril descartable.',
  )
  const order = await upsertOrderFromQuote('PED-0001', quote, 'APPROVED', 'OC-2026-00458')
  const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })
  const product = await prisma.product.findUniqueOrThrow({ where: { code: 'PT-KRQ-0016' } })

  const lot = await prisma.lot.upsert({
    where: { lotCode: 'I-2110185EK' },
    update: {
      orderId: order.id,
      orderItemId: orderItem.id,
      productId: product.id,
      quantity: orderItem.quantity,
      status: 'PLANNED',
    },
    create: {
      lotCode: 'I-2110185EK',
      orderId: order.id,
      orderItemId: orderItem.id,
      productId: product.id,
      quantity: orderItem.quantity,
      status: 'PLANNED',
    },
  })

  await prisma.labelApproval.upsert({
    where: { lotId: lot.id },
    update: {},
    create: { lotId: lot.id, status: 'PENDING' },
  })

  const productionOrder = await prisma.productionOrder.upsert({
    where: { lotId: lot.id },
    update: {},
    create: { code: 'OP-0001', lotId: lot.id, status: 'RELEASED', brand: 'BIOSAFE' },
  })

  const materials = await explodeMaterialsMultiLevel(product.id, Number(orderItem.quantity))
  await prisma.productionOrderMaterial.deleteMany({ where: { productionOrderId: productionOrder.id } })
  for (const material of materials) {
    await prisma.productionOrderMaterial.create({
      data: {
        productionOrderId: productionOrder.id,
        rawMaterialId: material.rawMaterialId,
        materialClass: material.componentClass,
        requiredQuantity: material.totalRequiredWithWaste,
        unit: material.unit,
      },
    })
  }

  await seedMainCaseProgressAndDispatches(productionOrder.id, lot.id)
  await seedMainCaseOperationalData(productionOrder.id)
}

/**
 * Caso demo PD GLOBAL — Cotización 3CBIO01-179, Kit de laparotomía estéril
 * descartable x 13 piezas, 100 kits, entidad AVIVA. Costo/precio viven
 * únicamente en QuoteItem (snapshot comercial de esta cotización); nunca
 * se copian al maestro de Producto ni de Materia Prima. Flujo completo:
 * Cotización → Pedido → Lote → Orden de Producción, con materia prima
 * consolidada por explosión multinivel (el envoltorio queda separado
 * dentro de Material de Empaque, el indicador químico sí cuenta como
 * pieza comercial en este kit).
 */
async function seedLaparotomiaDemoCase() {
  const quote = await upsertQuote(
    '3CBIO01-179',
    'PD GLOBAL',
    'APPROVED',
    [
      {
        productCode: 'PT-KLP-0001',
        quantity: 100,
        unitCostWithTax: 34.3907,
        unitCostWithoutTax: 30.7555,
        marginPercentage: 28,
        unitPriceWithTax: 50.4049,
      },
    ],
    'Entidad: AVIVA. Actualización PD GLOBAL — Kit de laparotomía estéril descartable x 13 ' +
      'piezas, 100 kits. Cambios respecto a la versión anterior (según el propio Excel de ' +
      'referencia): batas reforzadas con mangas ranglan (antes mangas largas), poncho con ' +
      'bolsillos laterales junto a la fenestra (antes poncho simple con adhesivo de 5), ' +
      'envoltorio en laminado de 60 g/m².',
  )
  // Código de Pedido distintivo (no numérico secuencial PED-00xx) para no
  // colisionar con códigos de prueba creados manualmente vía la UI en
  // sesiones anteriores de este proyecto.
  const order = await upsertOrderFromQuote(
    'PED-3CBIO01-179',
    quote,
    'APPROVED',
    'OC-AVIVA-3CBIO01-179',
  )
  const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })
  const product = await prisma.product.findUniqueOrThrow({ where: { code: 'PT-KLP-0001' } })

  const lot = await prisma.lot.upsert({
    where: { lotCode: 'L-2609240179' },
    update: {
      orderId: order.id,
      orderItemId: orderItem.id,
      productId: product.id,
      quantity: orderItem.quantity,
      status: 'PLANNED',
    },
    create: {
      lotCode: 'L-2609240179',
      orderId: order.id,
      orderItemId: orderItem.id,
      productId: product.id,
      quantity: orderItem.quantity,
      status: 'PLANNED',
    },
  })

  await prisma.labelApproval.upsert({
    where: { lotId: lot.id },
    update: {},
    create: { lotId: lot.id, status: 'PENDING' },
  })

  const productionOrder = await prisma.productionOrder.upsert({
    where: { lotId: lot.id },
    update: {},
    create: { code: 'OP-0002', lotId: lot.id, status: 'RELEASED', brand: 'BIOSAFE' },
  })

  const materials = await explodeMaterialsMultiLevel(product.id, Number(orderItem.quantity))
  await prisma.productionOrderMaterial.deleteMany({ where: { productionOrderId: productionOrder.id } })
  for (const material of materials) {
    await prisma.productionOrderMaterial.create({
      data: {
        productionOrderId: productionOrder.id,
        rawMaterialId: material.rawMaterialId,
        materialClass: material.componentClass,
        requiredQuantity: material.totalRequiredWithWaste,
        unit: material.unit,
      },
    })
  }

  await prisma.productionOrder.update({
    where: { id: productionOrder.id },
    data: {
      notes:
        'Cotización 3CBIO01-179 (PD GLOBAL / AVIVA). 13 piezas comerciales × 100 kits = 1,300 ' +
        'piezas comerciales. Envoltorio (material de empaque) e indicador químico (cuenta como ' +
        'pieza en este kit) consolidados por separado en la explosión de materia prima.',
      productionDate: new Date('2026-09-22'),
      dueDate: new Date('2026-09-29'),
    },
  })
}

/**
 * Datos operativos de demostración (Iteración 9, punto 1): observaciones,
 * dispensación de un par de materiales y firmas — para que la hoja de OP
 * impresa se vea tan completa como el ejemplo de referencia
 * `orden_prod_rellena.png`, usando los nuevos endpoints de edición en
 * lugar de escribir directo "a mano" solo en la demo.
 */
async function seedMainCaseOperationalData(productionOrderId: number) {
  await prisma.productionOrder.update({
    where: { id: productionOrderId },
    data: {
      notes: 'Producción 250 kits — lote liberado a almacén de producto terminado.',
      productionDate: new Date('2026-09-12'),
      dueDate: new Date('2026-09-19'),
      technicalDirectorName: 'Rojas Acosta Gleny Evelyn',
      technicalDirectorDate: new Date('2026-09-17'),
      productionManagerName: 'Fernández Quispe Omar',
      productionManagerDate: new Date('2026-09-17'),
    },
  })

  const materials = await prisma.productionOrderMaterial.findMany({
    where: { productionOrderId },
    include: { rawMaterial: true },
    orderBy: { id: 'asc' },
  })
  const telaSms = materials.find((m) => m.rawMaterial.code === 'TELA-SMS-35')
  if (telaSms) {
    await prisma.productionOrderMaterial.update({
      where: { id: telaSms.id },
      data: {
        dispensedLot: 'L-TELA-0912',
        protocolNumber: 'PR-0451',
        dispensedQuantity: 3040,
        dispensedDate: new Date('2026-09-12'),
        returnedQuantity: 5,
        warehouseApproval: true,
        productionApproval: true,
      },
    })
  }
  const adhesivo = materials.find((m) => m.rawMaterial.code === 'AD-1850')
  if (adhesivo) {
    await prisma.productionOrderMaterial.update({
      where: { id: adhesivo.id },
      data: {
        dispensedLot: 'L-ADH-0912',
        protocolNumber: 'PR-0452',
        dispensedQuantity: 715,
        dispensedDate: new Date('2026-09-12'),
        additionalQuantity: 6,
        warehouseApproval: true,
        productionApproval: false,
      },
    })
  }
}

/**
 * Avance realista para el caso demo principal (ruta F01: Corte → Costura →
 * Empaque → Esterilización → Control de calidad final → Producto
 * terminado), más un despacho parcial. Los códigos de paso usados aquí
 * ('CORTE', 'COSTURA', etc.) son los pasos reales sembrados por
 * `seedRouteSteps()` para F01 — no un contrato que la lógica de cálculo
 * dependa de ellos: `status-summary.service.ts` deriva PT y control de
 * calidad de forma genérica (último paso de la ruta / último paso cuyo
 * nombre referencia "calidad"), sin conocer estos códigos.
 */
async function seedMainCaseProgressAndDispatches(productionOrderId: number, lotId: number) {
  await prisma.productionProgress.deleteMany({ where: { productionOrderId } })
  await prisma.dispatch.deleteMany({ where: { lotId } })

  const steps = await prisma.routeStep.findMany({
    where: { route: { code: 'F01' }, active: true },
  })
  const stepByCode = Object.fromEntries(steps.map((step) => [step.code, step]))

  const entries: { stepCode: string; quantity: number; daysAgo: number; notes: string }[] = [
    { stepCode: 'CORTE', quantity: 250, daysAgo: 6, notes: 'Corte completo del lote.' },
    { stepCode: 'COSTURA', quantity: 220, daysAgo: 5, notes: 'Avance de costura.' },
    { stepCode: 'EMPAQUE', quantity: 200, daysAgo: 4, notes: 'Empaque parcial del lote.' },
    { stepCode: 'ESTERIL', quantity: 180, daysAgo: 3, notes: 'Ciclo de esterilización parcial.' },
    { stepCode: 'CC-FINAL', quantity: 160, daysAgo: 2, notes: 'Control de calidad final parcial.' },
    { stepCode: 'PT', quantity: 150, daysAgo: 1, notes: 'Ingreso a almacén de producto terminado.' },
  ]

  for (const entry of entries) {
    const step = stepByCode[entry.stepCode]
    if (!step) continue
    const date = new Date()
    date.setDate(date.getDate() - entry.daysAgo)
    await prisma.productionProgress.create({
      data: {
        productionOrderId,
        lotId,
        routeStepId: step.id,
        date,
        quantity: entry.quantity,
        notes: entry.notes,
      },
    })
  }

  const dispatchDate = new Date()
  dispatchDate.setDate(dispatchDate.getDate() - 1)
  await prisma.dispatch.create({
    data: {
      lotId,
      date: dispatchDate,
      quantity: 100,
      guideNumber: 'GR-000123',
      notes: 'Primer despacho parcial a Clínica Unión.',
    },
  })
}

async function seedAdditionalCommercialDemo() {
  await upsertQuote('COT-0002', 'FALDO', 'DRAFT', [{ productCode: 'PT-CQE-0012', quantity: 500 }])

  await upsertQuote('COT-0003', 'PROSEMEDIC', 'SENT', [
    { productCode: 'PT-SQE-0005', quantity: 200 },
  ])

  await upsertQuote(
    'COT-0004',
    'DROFAR',
    'REJECTED',
    [{ productCode: 'PT-MQM-0002', quantity: 100 }],
    'Rechazada por el cliente: solicitó otro proveedor de tela.',
  )

  const pendingReviewQuote = await upsertQuote('COT-0005', 'UTILITARIOS', 'APPROVED', [
    { productCode: 'PT-MQL-0003', quantity: 300 },
  ])
  await upsertOrderFromQuote('PED-0002', pendingReviewQuote, 'PENDING_REVIEW')

  const reviewedQuote = await upsertQuote('COT-0006', 'PD GLOBAL', 'APPROVED', [
    { productCode: 'PT-CQF-0008', quantity: 400 },
  ])
  await upsertOrderFromQuote('PED-0003', reviewedQuote, 'REVIEWED')
}

async function upsertPlanningLot(
  lotCode: string,
  orderCode: string,
  order: { id: number },
  productCode: string,
  quantity: number,
) {
  const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })
  const product = await prisma.product.findUniqueOrThrow({ where: { code: productCode } })
  return prisma.lot.upsert({
    where: { lotCode },
    update: {
      orderId: order.id,
      orderItemId: orderItem.id,
      productId: product.id,
      quantity,
      status: 'PLANNED',
    },
    create: {
      lotCode,
      orderId: order.id,
      orderItemId: orderItem.id,
      productId: product.id,
      quantity,
      status: 'PLANNED',
    },
  })
}

/**
 * Capacidades de planta (Iteración 8) y lotes adicionales listos para
 * planeamiento (sin programación aún — se generan en vivo desde
 * /planning/plant durante la demo). I-2110185EK ya existe desde el caso
 * demo principal y también queda disponible para planeamiento.
 */
async function seedPlantScheduling() {
  const campos = await prisma.productFamily.findUniqueOrThrow({ where: { code: 'CAMPOS' } })
  const ropa = await prisma.productFamily.findUniqueOrThrow({ where: { code: 'ROPA_QUIRURGICA' } })
  const sabanas = await prisma.productFamily.findUniqueOrThrow({ where: { code: 'SABANAS' } })
  const kit = await prisma.product.findUniqueOrThrow({ where: { code: 'PT-KRQ-0016' } })

  const capacities = [
    { code: 'CAP-KIT', name: 'Línea Kits Quirúrgicos', dailyCapacity: 50, unit: 'kits/día', productId: kit.id },
    { code: 'CAP-CAMPOS', name: 'Línea Campos', dailyCapacity: 200, unit: 'unidades/día', productFamilyId: campos.id },
    { code: 'CAP-ROPA', name: 'Línea Ropa Quirúrgica', dailyCapacity: 150, unit: 'unidades/día', productFamilyId: ropa.id },
    { code: 'CAP-SABANAS', name: 'Línea Sábanas', dailyCapacity: 120, unit: 'unidades/día', productFamilyId: sabanas.id },
  ]
  for (const capacity of capacities) {
    await prisma.plantCapacity.upsert({
      where: { code: capacity.code },
      update: capacity,
      create: capacity,
    })
  }

  const s1Quote = await upsertQuote('COT-0007', 'ANGLOMED', 'APPROVED', [
    { productCode: 'PT-SQE-0005', quantity: 400 },
  ])
  const s1Order = await upsertOrderFromQuote('PED-0004', s1Quote, 'APPROVED')
  await upsertPlanningLot('S-2080156EL', 'PED-0004', s1Order, 'PT-SQE-0005', 400)

  const s2Quote = await upsertQuote('COT-0008', 'FALDO', 'APPROVED', [
    { productCode: 'PT-CQE-0012', quantity: 600 },
  ])
  const s2Order = await upsertOrderFromQuote('PED-0005', s2Quote, 'APPROVED')
  await upsertPlanningLot('S-2030046EE', 'PED-0005', s2Order, 'PT-CQE-0012', 600)

  const s3Quote = await upsertQuote('COT-0009', 'PROSEMEDIC', 'APPROVED', [
    { productCode: 'PT-CQF-0008', quantity: 350 },
  ])
  const s3Order = await upsertOrderFromQuote('PED-0006', s3Quote, 'APPROVED')
  await upsertPlanningLot('S-2070045EE', 'PED-0006', s3Order, 'PT-CQF-0008', 350)

  const s4Quote = await upsertQuote('COT-0010', 'DROFAR', 'APPROVED', [
    { productCode: 'PT-MQM-0002', quantity: 200 },
  ])
  const s4Order = await upsertOrderFromQuote('PED-0007', s4Quote, 'APPROVED')
  await upsertPlanningLot('S-2080225EE', 'PED-0007', s4Order, 'PT-MQM-0002', 200)
}

/**
 * Caso real de ruta F02 (Iteración 9, punto 3): producto, lote y OP
 * completos para verificar visualmente que Esterilización y Control de
 * calidad final no aparecen fuera de F01 — la ruta F02 real no tiene esos
 * pasos, así que no hay nada que ocultar "a mano": Registro Diario, el
 * detalle de OP y Situación de Pedido simplemente no los listan porque
 * `status-summary.service.ts` deriva los pasos de la ruta real del
 * producto, no de un código fijo.
 */
async function seedF02DemoCase() {
  const quote = await upsertQuote(
    'COT-0011',
    'UTILITARIOS',
    'APPROVED',
    [{ productCode: 'PT-CQA-0099', quantity: 300 }],
    'Caso demo ruta F02 (individual aséptico, sin esterilización).',
  )
  const order = await upsertOrderFromQuote('PED-0008', quote, 'APPROVED')
  const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })
  const product = await prisma.product.findUniqueOrThrow({ where: { code: 'PT-CQA-0099' } })

  const lot = await prisma.lot.upsert({
    where: { lotCode: 'A-2609180001' },
    update: {
      orderId: order.id,
      orderItemId: orderItem.id,
      productId: product.id,
      quantity: orderItem.quantity,
      status: 'IN_PRODUCTION',
    },
    create: {
      lotCode: 'A-2609180001',
      orderId: order.id,
      orderItemId: orderItem.id,
      productId: product.id,
      quantity: orderItem.quantity,
      status: 'IN_PRODUCTION',
    },
  })

  await prisma.labelApproval.upsert({
    where: { lotId: lot.id },
    update: {},
    create: { lotId: lot.id, status: 'PENDING' },
  })

  const productionOrder = await prisma.productionOrder.upsert({
    where: { lotId: lot.id },
    update: {},
    create: { code: 'OP-0003', lotId: lot.id, status: 'IN_PRODUCTION', brand: 'BIOSAFE' },
  })

  const materials = await explodeMaterialsMultiLevel(product.id, Number(orderItem.quantity))
  await prisma.productionOrderMaterial.deleteMany({ where: { productionOrderId: productionOrder.id } })
  for (const material of materials) {
    await prisma.productionOrderMaterial.create({
      data: {
        productionOrderId: productionOrder.id,
        rawMaterialId: material.rawMaterialId,
        materialClass: material.componentClass,
        requiredQuantity: material.totalRequiredWithWaste,
        unit: material.unit,
      },
    })
  }

  await prisma.productionProgress.deleteMany({ where: { productionOrderId: productionOrder.id } })
  const steps = await prisma.routeStep.findMany({ where: { route: { code: 'F02' }, active: true } })
  const stepByCode = Object.fromEntries(steps.map((step) => [step.code, step]))
  const entries: { stepCode: string; quantity: number; daysAgo: number; notes: string }[] = [
    { stepCode: 'CORTE', quantity: 300, daysAgo: 4, notes: 'Corte completo del lote (F02).' },
    { stepCode: 'COSTURA', quantity: 280, daysAgo: 3, notes: 'Avance de costura (F02).' },
    { stepCode: 'EMPAQUE', quantity: 260, daysAgo: 2, notes: 'Empaque aséptico parcial (sin esterilización).' },
    { stepCode: 'PT', quantity: 200, daysAgo: 1, notes: 'Ingreso a almacén de producto terminado (F02).' },
  ]
  for (const entry of entries) {
    const step = stepByCode[entry.stepCode]
    if (!step) continue
    const date = new Date()
    date.setDate(date.getDate() - entry.daysAgo)
    await prisma.productionProgress.create({
      data: {
        productionOrderId: productionOrder.id,
        lotId: lot.id,
        routeStepId: step.id,
        date,
        quantity: entry.quantity,
        notes: entry.notes,
      },
    })
  }
}

/**
 * Tiempos estándar demo (Iteración 9, punto 2): solo para los productos/
 * pasos indicados — el resto de piezas queda sin registro a propósito para
 * verificar que Situación de Pedido muestra el campo vacío en lugar de
 * inventar un valor.
 */
async function seedStandardTimes() {
  const stepsByRouteCode: Record<string, Record<string, number>> = {}
  for (const routeCode of ['F01', 'F02']) {
    const steps = await prisma.routeStep.findMany({ where: { route: { code: routeCode } } })
    stepsByRouteCode[routeCode] = Object.fromEntries(steps.map((s) => [s.code, s.id]))
  }

  const entries: {
    productCode: string
    routeCode: string
    stepCode: string
    standardTimeMinutes: number
    people: number
  }[] = [
    { productCode: 'PT-MQL-0003', routeCode: 'F01', stepCode: 'CORTE', standardTimeMinutes: 1.2, people: 2 },
    { productCode: 'PT-MQL-0003', routeCode: 'F01', stepCode: 'COSTURA', standardTimeMinutes: 4.5, people: 2 },
    { productCode: 'PT-MQL-0003', routeCode: 'F01', stepCode: 'EMPAQUE', standardTimeMinutes: 0.8, people: 1 },
    { productCode: 'PT-SQE-0005', routeCode: 'F01', stepCode: 'CORTE', standardTimeMinutes: 1.0, people: 2 },
    { productCode: 'PT-SQE-0005', routeCode: 'F01', stepCode: 'COSTURA', standardTimeMinutes: 3.8, people: 2 },
    { productCode: 'PT-CQE-0012', routeCode: 'F01', stepCode: 'CORTE', standardTimeMinutes: 0.6, people: 1 },
    { productCode: 'PT-CQE-0012', routeCode: 'F01', stepCode: 'COSTURA', standardTimeMinutes: 2.1, people: 1 },
    { productCode: 'PT-CQA-0099', routeCode: 'F02', stepCode: 'CORTE', standardTimeMinutes: 0.6, people: 1 },
    { productCode: 'PT-CQA-0099', routeCode: 'F02', stepCode: 'COSTURA', standardTimeMinutes: 1.9, people: 1 },
    { productCode: 'PT-CQA-0099', routeCode: 'F02', stepCode: 'EMPAQUE', standardTimeMinutes: 0.5, people: 1 },
  ]

  for (const entry of entries) {
    const product = await prisma.product.findUniqueOrThrow({ where: { code: entry.productCode } })
    const routeStepId = stepsByRouteCode[entry.routeCode][entry.stepCode]
    await prisma.productStandardTime.upsert({
      where: { productId_routeStepId: { productId: product.id, routeStepId } },
      update: { standardTimeMinutes: entry.standardTimeMinutes, people: entry.people },
      create: {
        productId: product.id,
        routeStepId,
        standardTimeMinutes: entry.standardTimeMinutes,
        people: entry.people,
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Registros Sanitarios reales de BIOSAFE (DIGEMID). Datos extraídos
// visualmente de los PDF originales en `docs/` (no de OCR ciego): cada
// registro es UNA entidad con sus resoluciones (inscripción + cambios
// posteriores) y sus ítems/códigos autorizados — nunca se crea un registro
// nuevo por cada resolución. Los PDF originales se copian sin modificar a
// `backend/uploads/sanitary-registrations/` y se referencian como
// documento único por registro (contienen varias resoluciones fusionadas
// en un solo archivo, tal como fueron entregados).
// ---------------------------------------------------------------------------

interface SanitaryItemSeed {
  n: number
  code: string
  description: string
  productCode?: string
  notes?: string
}

interface SanitaryChangeSeed {
  resolutionNumber: string
  changeType: 'INSCRIPCION' | 'MODIFICACION' | 'RENOVACION' | 'ACTUALIZACION' | 'OTRO'
  resolutionDate: Date
  description: string
  notes?: string
}

interface SanitaryRegistrationSeed {
  code: string
  registrationNumber: string
  title: string
  medicalDeviceClass: string
  issuingAuthority: string
  manufacturer: string
  country: string
  brand: string
  issueDate: Date
  expirationDate: Date
  notes: string
  items: SanitaryItemSeed[]
  changes: SanitaryChangeSeed[]
  documentFile: string
  documentType: string
  documentDate: Date
}

// --- DM0682N: Campos, ponchos, cubremesa y sábanas quirúrgicas ------------
// Inscripción original (R.D. 1826-2023, 115 ítems) + inclusión de nuevos
// códigos (R.D. 866-2025, C-116 a C-217) + actualización de rotulado/color
// sobre los ítems 1-115 (R.D. 6992-2026, no agrega códigos nuevos).
const CAMPOS_ITEMS: SanitaryItemSeed[] = [
  { n: 1, code: 'CQE', description: 'CAMPO QUIRURGICO ESTERIL DESCARTABLE' },
  { n: 2, code: 'CQH', description: 'CAMPO QUIRURGICO CON ADHESIVO ESTERIL DESCARTABLE', productCode: 'PT-CQE-0012' },
  { n: 3, code: 'CQR', description: 'CAMPO QUIRURGICO REFORZADO ESTERIL DESCARTABLE', productCode: 'PT-CQR-0001' },
  { n: 4, code: 'CQD', description: 'CAMPO QUIRURGICO DOBLE ESTERIL DESCARTABLE' },
  { n: 5, code: 'CQF', description: 'CAMPO QUIRURGICO FENESTRADO ESTERIL DESCARTABLE' },
  { n: 6, code: 'CFA', description: 'CAMPO QUIRURGICO FENESTRADO CON ADHESIVO ESTERIL DESCARTABLE', productCode: 'PT-CQF-0008' },
  { n: 7, code: 'CFR', description: 'CAMPO QUIRURGICO FENESTRADO CON REFUERZO ESTERIL DESCARTABLE' },
  { n: 8, code: 'CFD', description: 'CAMPO QUIRURIGO FENESTRADO DOBLE ESTERIL DESCARTABLE' },
  { n: 9, code: 'CQI', description: 'CAMPO QUIRURGICO DE INCISIÓN ESTERIL DESCARTABLE' },
  { n: 10, code: 'CQA', description: 'CAMPO QUIRURGICO ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 11, code: 'CAB', description: 'CAMPO QUIRURGICO ABDOMINAL ESTERIL DESCARTABLE' },
  { n: 12, code: 'CLA', description: 'CAMPO QUIRURGICO LATERAL ESTERIL DESCARTABLE' },
  { n: 13, code: 'CAN', description: 'CAMPO ANGIOGRAFICO ESTERIL DESCARTABLE' },
  { n: 14, code: 'CNR', description: 'CAMPO ANGIOGRAFICO REFORZADO ESTERIL DESCARTABLE' },
  { n: 15, code: 'CAP', description: 'CAMPO QUIRURGICO DE ANGIOGRAFIA ESTERIL DESCARTABLE CON DOS PARCHES ADHESIVOS Y ABERTURA OVAL' },
  { n: 16, code: 'CCE', description: 'CAMPO QUIRURGICO PARA CESAREA ESTERIL DESCARTABLE' },
  { n: 17, code: 'CEP', description: 'CAMPO QUIRURGICO PARA CESAREA CON PELICULA DE INCISION ESTERIL DESCARTABLE' },
  { n: 18, code: 'CEB', description: 'CAMPO QUIRURGICO PARA CESAREA CON BOLSILLOS RECOLECTORES DE FLUIDOS' },
  { n: 19, code: 'CPA', description: 'CAMPO PARA PARTO ESTERIL DESCARTABLE' },
  { n: 20, code: 'CPB', description: 'CAMPO PARA PARTO CON BOLSILLO RECOLECTOR DE FLUIDOS ESTERIL DESCARTABLE' },
  { n: 21, code: 'CDH', description: 'CAMPO QUIRURGICO DESCARTABLE ESTERIL HENDIDO C/ADHESIVO' },
  { n: 22, code: 'CCL', description: 'CAMPO CLINICO ESTERIL DESCARTABLE' },
  { n: 23, code: 'CSI', description: 'CAMPO SIMPLE ESTERIL DESCARTABLE' },
  { n: 24, code: 'CAX', description: 'CAMPO AUXILIAR ESTERIL DESCARTABLE' },
  { n: 25, code: 'CQU', description: 'CAMPO QUIRURGICO EN U ESTERIL DESCARTABLE' },
  { n: 26, code: 'CUH', description: 'CAMPO QUIRURGICO EN U CON ADHESIVO ESTERIL DESCARTABLE' },
  { n: 27, code: 'CGI', description: 'CAMPO QUIRURGICO GINECOLOGICO ESTERIL DESCARTABLE' },
  { n: 28, code: 'CRT', description: 'CAMPO PARA RTU ESTERIL DESCARTABLE' },
  { n: 29, code: 'CML', description: 'CAMPO MEDIA LUNA ESTERIL DESCARTABLE' },
  { n: 30, code: 'CMR', description: 'CAMPO MEDIA LUNA REFORZADO ESTERIL DESCARTABLE' },
  { n: 31, code: 'CMD', description: 'CAMPO MEDIA LUNA DOBLE ESTERIL DESCARTABLE' },
  { n: 32, code: 'CME', description: 'CAMPO DE MESA / SOBREMESA QUIRURGICA ESTERIL DESCARTABLE' },
  { n: 33, code: 'CAA', description: 'CAMPO QUIRURGICO CON APERTURA ESTERIL DESCARTABLE' },
  { n: 34, code: 'CFL', description: 'CAMPO QUIRURGICO ABDOMINAL CON BOLSILLOS RECOLECTORES DE FLUIDOS' },
  { n: 35, code: 'CBO', description: 'CAMPO QUIRURGICO CON BOLSILLO RECOLECTOR DE FLUIDOS' },
  { n: 36, code: 'COF', description: 'CAMPO OFTALMOLOGICO ESTERIL DESCARTABLE' },
  { n: 37, code: 'COB', description: 'CAMPO OFTALMOLOGICO CON BOLSILLO RECOLECTOR DE FLUIDOS ESTERIL DESCARTABLE' },
  { n: 38, code: 'CAR', description: 'CAMPO DE ARTROSCOPIA DE RODILLA ESTERIL DESCARTABLE' },
  { n: 39, code: 'CAC', description: 'CAMPO DE ARTROSCOPIA DE CADERA ESTERIL DESCARTABLE' },
  { n: 40, code: 'CAH', description: 'CAMPO DE ARTROSCOPIA DE HOMBRO ESTERIL DESCARTABLE' },
  { n: 41, code: 'CCM', description: 'CAMPO DE CIRUGIA MANO ESTERIL DESCARTABLE' },
  { n: 42, code: 'CTE', description: 'CAMPO DE TRAUMA ESTERIL DESCARTABLE' },
  { n: 43, code: 'PTU', description: 'CAMPO / PORTA TUBOS ESTERIL DESCARTABLE' },
  { n: 44, code: 'ENV', description: 'CAMPO / ENVOLTORIO ESTERIL DESCARTABLE' },
  { n: 45, code: 'END', description: 'CAMPO / ENVOLTORIO DOBLE ESTERIL DESCARTABLE' },
  { n: 46, code: 'TOA', description: 'CAMPO DE MANOS / TOALLA DE MANOS' },
  { n: 47, code: 'TAA', description: 'CAMPO SECANTE / TOALLA SECANTE / TOALLA ABSORBENTE' },
  { n: 48, code: 'PCH', description: 'PONCHO QUIRURGICO ESTERIL DESCARTABLE', productCode: 'PT-PON-0001' },
  { n: 49, code: 'PCR', description: 'PONCHO QUIRURGICO REFORZADO ESTERIL DESCARTABLE' },
  { n: 50, code: 'PCD', description: 'PONCHO QUIRURGICO DOBLE ESTERIL DESCARTABLE' },
  { n: 51, code: 'PCB', description: 'PONCHO QUIRURGICO CON BOLSILLOS DE RECOLECCION DE FLUIDOS ESTERIL DESCARTABLE' },
  { n: 52, code: 'PFL', description: 'PONCHO QUIRURGICO REFORZADO CON BOLSILLOS DE RECOLECCION DE FLUIDOS ESTERIL DESCARTABLE' },
  { n: 53, code: 'PAB', description: 'PONCHO QUIRURGICO ABDOMINAL ESTERIL DESCARTABLE' },
  { n: 54, code: 'PAR', description: 'PONCHO QUIRURGICO ABDOMINAL REFORZADO ESTERIL DESCARTABLE' },
  { n: 55, code: 'PAD', description: 'PONCHO QUIRURGICO ABDOMINAL DOBLE ESTERIL DESCARTABLE' },
  { n: 56, code: 'PAS', description: 'PONCHO QUIRURGICO SIMPLE ESTERIL DESCARTABLE' },
  { n: 57, code: 'SAQ', description: 'SABANA QUIRURGICA ESTERIL DESCARTALBE', productCode: 'PT-SQE-0005' },
  { n: 58, code: 'SAR', description: 'SABANA QUIRURGICA REFORZADA ESTERIL DESCARTABLE' },
  { n: 59, code: 'SAD', description: 'SABANA QUIRURGICA DOBLE ESTERIL DESCARTABLE' },
  { n: 60, code: 'SQF', description: 'SABANA QUIRURGICA CON FENESTRA Y BOLSILLOS RECOLECORES DE FLUIDOS ESTERIL DESCARTABLE' },
  { n: 61, code: 'SAI', description: 'SABANA QUIRURGICA INFERIOR ESTERIL DESCARTABLE' },
  { n: 62, code: 'SAS', description: 'SABANA QUIRURGICA SUPERIOR ESTERIL DESCARTABLE' },
  { n: 63, code: 'SLA', description: 'SABANA QUIRURGICA LATERAL ESTERIL DESCARTABLE' },
  { n: 64, code: 'SAB', description: 'SABANA QUIRURGICA ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 65, code: 'SAE', description: 'SABANA QUIRURGICA CON REFUERZO ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 66, code: 'SAU', description: 'SABANA QUIRURGICA EN U ESTERIL DESCARTABLE' },
  { n: 67, code: 'SUV', description: 'SABANA QUIRURGICA EN U VERTICAL ESTERIL DESCARTABLE / SABANA ORTOPEDICA EN U VERTICAL ESTERIL DESCARTABLE' },
  { n: 68, code: 'SUH', description: 'SABANA QUIRURGICA EN U HORIZONTAL ESTERIL DESCARTABLE / SABANA ORTOPEDICA EN U HORIZONTAL ESTERIL DESCARTABLE' },
  { n: 69, code: 'SOR', description: 'SABANA ORTOPEDICA ESTERIL DESCARTABLE' },
  { n: 70, code: 'SAT', description: 'SABANA DE ARTROSCOPIA DE RODILLA ESTERIL DESCARTABLE' },
  { n: 71, code: 'SAC', description: 'SABANA DE CADERA ESTERIL DESCARTABLE' },
  { n: 72, code: 'SAH', description: 'SABANA DE ARTROSCOPIA DE HOMBRO ESTERIL DESCARTABLE' },
  { n: 73, code: 'SAM', description: 'SABANA DE CIRUGIA DE MANO ESTERIL DESCARTABLE' },
  { n: 74, code: 'SAG', description: 'SABANA DE ANGIOGRAFIA ESTERIL DESCARTABLE' },
  { n: 75, code: 'SGR', description: 'SABANA DE ANGIOGRAFIA REFORZADA ESTERIL DESCARTABLE' },
  { n: 76, code: 'SGF', description: 'SABANA DE ANGIOGRAFIA FEMORAL ESTERIL DESCARTABLE' },
  { n: 77, code: 'SRB', description: 'SABANA DE ANGIOGRAFIA RADIAL/BRONQUIAL ESTERIL DESCARTABLE' },
  { n: 78, code: 'SCE', description: 'SABANA DE CESAREA ESTERIL DESCARTABLE' },
  { n: 79, code: 'SCB', description: 'SABANA DE CESAREA CON BOLSILLOS RECOLECTOR DE FLUIDOS ESTERIL DESCARTABLE' },
  { n: 80, code: 'SPA', description: 'SABANA DE PARTO ESTERIL DESCARTABLE' },
  { n: 81, code: 'SPB', description: 'SABANA DE PARTO CON BOLSILLO RECOLECTOR DE FLUIDOS ESTERIL DESCARTABLE' },
  { n: 82, code: 'SOF', description: 'SABANA OFTALMOLOGICA ESTERIL DESCARTABLE' },
  { n: 83, code: 'SOB', description: 'SABANA OFTALMOLOGICA CON BOLSILLOS RECOLECTOR DE FLUIDOS' },
  { n: 84, code: 'SLE', description: 'SABANA DE LAPAROSCOPÍA ESTERIL DESCARTABLE' },
  { n: 85, code: 'STU', description: 'SABANA TUR ESTERIL DESCARTABLE' },
  { n: 86, code: 'SUR', description: 'SABANA UROLOGICA ESTERIL DESCARTABLE' },
  { n: 87, code: 'SRT', description: 'SABANA PARA RTU ESTERIL DESCARTABLE' },
  { n: 88, code: 'SCD', description: 'SABANA CARDIOVASCULAR ESTERIL DESCARTABLE' },
  { n: 89, code: 'STO', description: 'SABANA TORAXICA ESTERIL DESCARTABLE' },
  { n: 90, code: 'SCR', description: 'SABANA DE CRANEOTOMIA ESTERIL DESCARTABLE' },
  { n: 91, code: 'SCU', description: 'CUBREMESA ANGULADA ESTERIL DESCARTABLE / CUBIERTA DE MESA ANGULADA ESTERIL DESCARTABLE' },
  { n: 92, code: 'CUB', description: 'CUBREMESA MEDIA LUNA ESTERIL DESCARTABLE' },
  { n: 93, code: 'CUM', description: 'CUBREMESA MEDIA LUNA REFORZADA ESTERIL DESCARTABLE' },
  { n: 94, code: 'CMD', description: 'CUBREMESA MEDIA LUNA DOBLE ESTERIL DESCARTABLE', notes: 'El PDF original reutiliza el código CMD, ya usado en el ítem 31 — se transcribe tal como figura en la resolución, sin corregirlo.' },
  { n: 95, code: 'MYE', description: 'CAMPO / CUBIERTA DE MESA DE MAYO ESTERIL DESCARTABLE' },
  { n: 96, code: 'MYR', description: 'CAMPO / CUBIERTA REFORZADA DE MESA MAYO ESTERIL DESCARTABLE' },
  { n: 97, code: 'MYD', description: 'CAMPO / CUBIERTA DOBLE DE MESA MAYO ESTERIL DESCARTABLE' },
  { n: 98, code: 'PMY', description: 'CAMPO / PISO ESTERIL DESCARTABLE' },
  { n: 99, code: 'PMD', description: 'CAMPO / PISO DOBLE ESTERIL DESCARTABLE' },
  { n: 100, code: 'SOL', description: 'CAMPO / SOLERA ESTERIL DESCARTABLE' },
  { n: 101, code: 'SER', description: 'CAMPO / SOLERA REFORZADA ESTERIL DESCARTABLE' },
  { n: 102, code: 'SOD', description: 'CAMPO/ SOLERA DOBLE ESTERIL DESCARTABLE' },
  { n: 103, code: 'CGC', description: 'CAMPO QUIRURGICO GINECOLOGICO /PARA CESAREA ESTERIL DESCARTABLE' },
  { n: 104, code: 'CPE', description: 'CAMPO PIERNERA ESTERIL DESCARTABLE' },
  { n: 105, code: 'CQM', description: 'CAMPO QUIRURGICO MEDIA LUNA DOBLE (CON REFUERZO) ESTERIL DESCARTABLE' },
  { n: 106, code: 'CRD', description: 'CAMPO / ENVOLTORIO DOBLE (CON REFUERZO) ESTERIL DESCARTABLE' },
  { n: 107, code: 'CFG', description: 'CAMPO FENESTRADO GINECOLOGICO PARA CESAREA ESTERIL DESCARTABLE' },
  { n: 108, code: 'CFB', description: 'CAMPO FENESTRADO ABDOMINAL ESTERIL DESCARTABLE' },
  { n: 109, code: 'CQS', description: 'CAMPO QUIRURGICO (TIPO SABANAS) ESTERIL DESCARTBLE' },
  { n: 110, code: 'PAE', description: 'PONCHO ANGIOGRAFICO ESTERIL DESCARTABLE' },
  { n: 111, code: 'AQD', description: 'PONCHO QUIRURGICO DOBLE (CON REFUERZO) ESTERIL DESCARTABLE' },
  { n: 112, code: 'PQA', description: 'PONCHO QUIRURGICO ABDOMINAL DOBLE (CON REFUERZO) ESTERIL DESCARTABLE' },
  { n: 113, code: 'PQD', description: 'PONCHO QUIRURGICO GINECOLOGICO PARA CESARIA ESTERIL DESCARTABLE' },
  { n: 114, code: 'SQD', description: 'SABANA QUIRURGICA DOBLE (CON REFUERZO) ESTERIL DESCARTABLE' },
  { n: 115, code: 'SAF', description: 'SABANA ANGIOGRAFICA FENESTRADA ESTERIL DESCARTABLE' },
  { n: 116, code: 'C-116', description: 'CAMPOS NO ABSORBENTES CON ADHESIVO ESTERIL DESCARTABLE' },
  { n: 117, code: 'C-117', description: 'CAMPO BARRA / CAPELINA ESTERIL DESCARTABLE' },
  { n: 118, code: 'C-118', description: 'CAMPOS AUXILIARES ESTERIL DESCARTABLE' },
  { n: 119, code: 'C-119', description: 'CAMPOS AUXILIARES IMPERMEABLES ESTERIL DESCARTABLE' },
  { n: 120, code: 'C-120', description: 'CAMPO PARA PRODUCTO ESTERIL DESCARTABLE' },
  { n: 121, code: 'C-121', description: 'CAMPO CADERA PARA PARTO ESTERIL DESCARTABLE' },
  { n: 122, code: 'C-122', description: 'CAMPO SECANTE / TOALLA SECANTE ESTERIL DESCARTABLE' },
  { n: 123, code: 'C-123', description: 'CAMPO SECANTE / TOALLA ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 124, code: 'C-124', description: 'CAMPO PAÑUELO / PAÑUELO ESTERIL DESCARTABLE' },
  { n: 125, code: 'C-125', description: 'CAMPO QUIRURGICO REFORZADO CON ADHESIVO ESTERIL DESCARTABLE' },
  { n: 126, code: 'C-126', description: 'CAMPO PARA MANOS DE CELULOSA BLANCAS DE DOBLE CARA ESTERIL DESCARTABLE' },
  { n: 127, code: 'C-127', description: 'SABANAS REPELENTES A FLUIDOS ESTERIL DESCARTABLE' },
  { n: 128, code: 'C-128', description: 'SABANA DE LAPAROTOMIA EN FORMA DE T FENESTRADO ESTERIL DESCARTABLE' },
  { n: 129, code: 'C-129', description: 'SABANA EN U LAMINADA CON ADHESIVOS ESTERIL DESCARTABLE' },
  { n: 130, code: 'C-130', description: 'SABANA ORTOPEDICA EN U PODALICA REFORZADA CON ADHESIVO Y PORTATUBO ESTERIL DESCARTABLE' },
  { n: 131, code: 'C-131', description: 'SABANA ORTOPEDICA EN U CEFALICA REFORZADA CON ADHESIVO Y PORTATUBO ESTERIL DESCARTABLE' },
  { n: 132, code: 'C-132', description: 'SABANA EN FORMA DE T ESTERIL DESCARTABLE' },
  { n: 133, code: 'C-133', description: 'SABANA FENESTRADA CON REFUERZO ESTERIL DESCARTABLE' },
  { n: 134, code: 'C-134', description: 'SABANA FENESTRADA ESTERIL DESCARTABLE' },
  { n: 135, code: 'C-135', description: 'SABANA U CABEZA Y CUELLO ESTERIL DESCARTABLE' },
  { n: 136, code: 'C-136', description: 'SABANA SUPERIOR GENERAL ESTERIL DESCARTABLE' },
  { n: 137, code: 'C-137', description: 'SABANAS LATERALES GENERAL ESTERIL DESCARTABLE' },
  { n: 138, code: 'C-138', description: 'SABANA INFERIOR GENERAL ESTERIL DESCARTABLE' },
  { n: 139, code: 'C-139', description: 'SABANA SUPERIOR BASICO AUTOADHERIBLE ESTERIL DESCARTABLE' },
  { n: 140, code: 'C-140', description: 'SABANA INFERIOR BASICO AUTOADHERIBLE ESTERIL DESCARTABLE' },
  { n: 141, code: 'C-141', description: 'SABANA U IMPERMEABLE ESTERIL DESCARTABLE' },
  { n: 142, code: 'C-142', description: 'SABANA U PARA ORTOPEDIA GENERAL ESTERIL DESCARTABLE' },
  { n: 143, code: 'C-143', description: 'SABANA SUPERIOR PARA ORTOPEDIA GENERAL ESTERIL DESCARTABLE' },
  { n: 144, code: 'C-144', description: 'SABANA PARA CESAREA ESTERIL DESCARTABLE' },
  { n: 145, code: 'C-145', description: 'SABANA SUPERIOR UNIVERSAL ESTERIL DESCARTABLE' },
  { n: 146, code: 'C-146', description: 'SABANA U UNIVERSAL ESTERIL DESCARTABLE' },
  { n: 147, code: 'C-147', description: 'SABANA ABDOMINAL ESTERIL DESCARTABLE' },
  { n: 148, code: 'C-148', description: 'SABANA ODONTOLOGICA ESTERIL DESCARTABLE' },
  { n: 149, code: 'C-149', description: 'SABANA FENESTRADA ESTERIL DESCARTABLE (CON FILM LAMINADO)' },
  { n: 150, code: 'C-150', description: 'SABANA QUIRURGICA CON ADHESIVO ESTERIL DESCARTABLE' },
  { n: 151, code: 'C-151', description: 'SABANA CON ADHESIVO ESTERIL DESCARTABLE' },
  { n: 152, code: 'C-152', description: 'SABANA QUIRURGICA REFORZADA CON ADHESIVO ESTERIL DESCARTABLE' },
  { n: 153, code: 'C-153', description: 'SABANA REFORZADA ESTERIL DESCARTABLE' },
  { n: 154, code: 'C-154', description: 'SABANA CON PIERNERA ESTERIL DESCARTABLE' },
  { n: 155, code: 'C-155', description: 'SABANA QUIRURGICA EN U VERTICAL ESTERIL DESCARTABLE' },
  { n: 156, code: 'C-156', description: 'SABANA ORTOPEDICA EN U HORIZONTAL ESTERIL DESCARTABLE' },
  { n: 157, code: 'C-157', description: 'SABANA QUIRURGICA EN U HORIZONTAL ESTERIL DESCARTABLE' },
  { n: 158, code: 'C-158', description: 'PONCHO GINECOLOGICO CON BOLSA RECOLECTORA DE FLUIDOS ESTERIL DESCARTABLE' },
  { n: 159, code: 'C-159', description: 'PONCHO FENESTRADO ESTERIL DESCARTABLE' },
  { n: 160, code: 'C-160', description: 'PONCHO QUIRURGICO FENESTRADO ESTERIL DESCARTABLE' },
  { n: 161, code: 'C-161', description: 'PONCHO CON PIERNERA ESTERIL DESCARTABLE' },
  { n: 162, code: 'C-162', description: 'PONCHO CON PIERNERA Y FENESTRADO ESTERIL DESCARTABLE' },
  { n: 163, code: 'C-163', description: 'PONCHO QUIRURGICO ABDOMINAL ESTERIL DESCARTABLE' },
  { n: 164, code: 'C-164', description: 'PONCHO QUIRURGICO GINECOLOGICO ESTERIL DESCARTABLE' },
  { n: 165, code: 'C-165', description: 'PONCHO QUIRURGICO GINECOLOGICO CON PIERNERA ESTERIL DESCARTABLE' },
  { n: 166, code: 'C-166', description: 'CAMPO DE SECADO PARA MANOS ESTERIL DESCARTABLE' },
  { n: 167, code: 'C-167', description: 'CAMPO TIPO BOLSA RECOLECTORA DE FLUIDOS ESTERIL DESCARTABLE' },
  { n: 168, code: 'C-168', description: 'CAMPO / CUBIERTA PARA MESA MEDIA LUNA CON REFUERZO EN FRANJA ESTERIL DESCARTABLE' },
  { n: 169, code: 'C-169', description: 'CAMPO PARA MANOS DE CELULOSA BLANCAS DE DOBLE CARA ESTERIL DESCARTABLE' },
  { n: 170, code: 'C-170', description: 'SABANAS REPELENTES A FLUIDOS' },
  { n: 171, code: 'C-171', description: 'SABANA ORTOPEDICA EN U PODALICA REFORZADA CON ADHESIVO Y PORTATUBO' },
  { n: 172, code: 'C-172', description: 'SOBREMESA PLASTIFICADO ESTERIL DESCARTABLE' },
  { n: 173, code: 'C-173', description: 'PONCHO CON PIERNERA ADULTO ESTERIL DESCARTABLE' },
  { n: 174, code: 'C-174', description: 'CAMPO DE MESA ESTERIL DESCARTABLE' },
  { n: 175, code: 'C-175', description: 'CAMPO QUIRURGICO GRANDE ESTERIL DESCARTABLE' },
  { n: 176, code: 'C-176', description: 'CAMPO QUIRURGICO MEDIANO ESTERIL DESCARTABLE' },
  { n: 177, code: 'C-177', description: 'CAMPO / PISO DOBLE PARA MESA MAYO ESTERIL DESCARTABLE' },
  { n: 178, code: 'C-178', description: 'PONCHO UROLOGICO CON BOLSA REOCLECTORA ESTERIL DESCARTABLE' },
  { n: 179, code: 'C-179', description: 'PONCHO UROLOGICO ESTERIL DESCARTABLE' },
  { n: 180, code: 'C-180', description: 'SABANA ANGIOGRAFICA ESTERIL DESCARTABLE' },
  { n: 181, code: 'C-181', description: 'SABANA PODALICA ESTERIL DESCARTABLE' },
  { n: 182, code: 'C-182', description: 'SOLERA QUIRURGICA ESTERIL DESCARTABLE' },
  { n: 183, code: 'C-183', description: 'SOLERA QUIRURGICA ESTERIL DESCARTABLE' },
  { n: 184, code: 'C-184', description: 'CAMPO PLASTIFICADO RESISTENTE A LOS FLUIDOS PARA MESA ANGULAR ESTERIL DESCARTABLE' },
  { n: 185, code: 'C-185', description: 'CAMPO PAÑAL ESTERIL DESCARTABLE' },
  { n: 186, code: 'C-186', description: 'CAMPO / CUBREMESA REFORZADO ESTERIL DESCARTABLE' },
  { n: 187, code: 'C-187', description: 'CAMPO / SOBREMESA (ENVOLTORIO) CON REFUERZO LAMINADO ESTERIL DESCARTABLE' },
  { n: 188, code: 'C-188', description: 'CAMPO / TAPETE ESTERIL DESCARTABLE' },
  { n: 189, code: 'C-189', description: 'CAMPO / CUBIERTA DE MESA RIÑON ESTERIL DESCARTABLE' },
  { n: 190, code: 'C-190', description: 'CAMPO / PISO ESTERIL DESCARTABLE' },
  { n: 191, code: 'C-191', description: 'CAMPO / CORTINA LATERAL ADHESIVA ESTERIL DESCARTABLE' },
  { n: 192, code: 'C-192', description: 'CAMPO / CORTINA SUPERIOR CON ADHESIVO ESTERIL DESCARTABLE' },
  { n: 193, code: 'C-193', description: 'CAMPO / PAÑUELO ESTERIL DESCARTABLE' },
  { n: 194, code: 'C-194', description: 'PONCHO QUIRURGICO CON BOLSILLOS LATERALES' },
  { n: 195, code: 'C-195', description: 'CAMPO DOBLE (ENVOLTORIO) ESTERIL DESCARTABLE' },
  { n: 196, code: 'C-196', description: 'SABANA DE ABDOMINOPLASTIA ESTERIL DESCARTABLE' },
  { n: 197, code: 'C-197', description: 'SABANA DE NEUROCIRUGIA ESTERIL DESCARTABLE' },
  { n: 198, code: 'C-198', description: 'SABANA DE INTERVENCIONISMO ESTERIL DESCARTABLE' },
  { n: 199, code: 'C-199', description: 'SABANA ENDOVASCULAR ESTERIL DESCARTABLE' },
  { n: 200, code: 'C-200', description: 'SABANA DE LAPAROTOMIA ESTERIL DESCARTABLE' },
  { n: 201, code: 'C-201', description: 'SABANA DE LIPOESCULTURA ESTERIL DESCARTABLE' },
  { n: 202, code: 'C-202', description: 'SABANA DE NEUROCIRUGIA / CRANEOTOMIA ESTERIL DESCARTABLE' },
  { n: 203, code: 'C-203', description: 'SABANA DE INTERVENCIONISMO / ENDOVASCULAR ESTERIL DESCARTABLE' },
  { n: 204, code: 'C-204', description: 'SABANA DE HEMODINAMIA ESTERIL DESCARTABLE' },
  { n: 205, code: 'C-205', description: 'CAMPO ENVOLVEDERA ESTERIL DESCARTABLE' },
  { n: 206, code: 'C-206', description: 'CAMPO QUIRURGICO IMPERMEABLE ESTERIL DESCARTABLE' },
  { n: 207, code: 'C-207', description: 'SABANA PLANA ESTERIL DESCARTABLE' },
  { n: 208, code: 'C-208', description: 'CAMPO PARA PARTO ESTERIL DESCARTABLE' },
  { n: 209, code: 'C-209', description: 'CAMPO AUXILIAR CON ADHESIVO ESTERIL DESCARTABLE' },
  { n: 210, code: 'C-210', description: 'SABANA CON ADHESIVO ESTERIL DESCARTABLE' },
  { n: 211, code: 'C-211', description: 'SABANA DE ESPECIALIDAD FENESTRADA ESTERIL DESCARTABLE' },
  { n: 212, code: 'C-212', description: 'CAMPO PARA MAMPARA ESTERIL DESCARTABLE' },
  { n: 213, code: 'C-213', description: 'CAMPO PARA MATERIAL INSTRUMENTAL ESTERIL DESCARTABLE' },
  { n: 214, code: 'C-214', description: 'CAMPO OPERATORIO REFORZADO ESTERIL DESCARTABLE' },
  { n: 215, code: 'C-215', description: 'CAMPO DE MESA DE TRABAJO ESTERIL DESCARTABLE' },
  { n: 216, code: 'C-216', description: 'SABANA CON HENDIDURA EN U ESTERIL DESCARTABLE' },
  { n: 217, code: 'C-217', description: 'SABANA CON HENDIDURA ESTERIL DESCARTABLE' },
]

// --- DM0684N: Vestuario médico / ropa quirúrgica estéril descartable -----
const VESTUARIO_ITEMS: SanitaryItemSeed[] = [
  { n: 1, code: 'MQU', description: 'Mandil / Bata Quirúrgica Estéril Descartable (tallas XS a XXXL)', productCode: 'PT-MQL-0003', notes: 'El código oficial MQU cubre las tallas XS-XXXL en un solo ítem regulatorio; el maestro interno las modela como productos separados por talla (ver también PT-MQM-0002 talla M y PT-MQX-0004 talla XL).' },
  { n: 2, code: 'BQR', description: 'Bata Quirúrgica Reforzada Estéril Descartable' },
  { n: 3, code: 'BRR', description: 'Bata Quirúrgica con Refuerzo en Pecho y Mangas Estéril Descartable' },
  { n: 4, code: 'BAI', description: 'Bata de Aislamiento Estéril Descartable' },
  { n: 5, code: 'BPA', description: 'Bata de Paciente Estéril Descartable' },
  { n: 6, code: 'BPE', description: 'Bata para Examen Estéril Descartable' },
  { n: 7, code: 'MED', description: 'Mandilón estéril descartable' },
  { n: 8, code: 'CHE', description: 'Chaqueta Quirúrgica Estéril Descartable' },
  { n: 9, code: 'CHC', description: 'Chaqueta para Cirujano Estéril Descartable' },
  { n: 10, code: 'CHL', description: 'Chaqueta Manga Larga Estéril Descartable' },
  { n: 11, code: 'PAN', description: 'Pantalón Estéril Descartable' },
  { n: 12, code: 'PNC', description: 'Pantalón para Cirujano Estéril Descartable' },
  { n: 13, code: 'OVE', description: 'Mameluco/Overall Estéril Descartable' },
  { n: 14, code: 'OCA', description: 'Mameluco/Overall con Capucha Estéril Descartable' },
  { n: 15, code: 'OCU', description: 'Mameluco/Overall con Cubrebota Estéril Descartable' },
  { n: 16, code: 'OCI', description: 'Mameluco/Overall con Cierre Estéril Descartable' },
  { n: 17, code: 'OVC', description: 'Mameluco/Overall con Cierre y Cinta Duplo Estéril Descartable' },
  { n: 18, code: 'OCC', description: 'Mameluco/Overall con Capucha y Cubrebota Estéril Descartable' },
  { n: 19, code: 'OVV', description: 'Mameluco/Overall con Capucha, Cubrebota con Cierre Estéril Descartable' },
  { n: 20, code: 'OVT', description: 'Mameluco/Overall con Capucha, Cubrebota con Cierre y Cinta Duplo Estéril Descartable' },
  { n: 21, code: 'PEE', description: 'Pechera Estéril Descartable' },
  { n: 22, code: 'PER', description: 'Pechera Reforzada Estéril Descartable' },
  { n: 23, code: 'DEE', description: 'Delantal Quirúrgico Estéril Descartable' },
  { n: 24, code: 'DER', description: 'Delantal Quirúrgico Reforzado Estéril Descartable' },
  { n: 25, code: 'DQR', description: 'Delantal Quirúrgico Reforzado en Pecho y Mangas Estéril Descartable' },
  { n: 26, code: 'DNU', description: 'Delantal para Nutrición Estéril Descartable' },
  { n: 27, code: 'DNR', description: 'Delantal para Nutrición Reforzado Estéril Descartable' },
  { n: 28, code: 'GOE', description: 'Gorro Para Enfermera Estéril Descartable' },
  { n: 29, code: 'GOC', description: 'Gorro Para Cirujano Estéril Descartable' },
  { n: 30, code: 'CAP', description: 'Capucha Estéril Descartable' },
  { n: 31, code: 'CUB', description: 'Cubrecalzado Estéril Descartable' },
  { n: 32, code: 'CBB', description: 'Cubrebota Estéril Descartable' },
  { n: 33, code: 'KCP', description: 'Kit Chaqueta - Pantalón Estéril Descartable' },
  { n: 34, code: 'KGM', description: 'Kit de Gorro, Cubrecalzado Estéril Descartable' },
  { n: 35, code: 'KCI', description: 'Kit de Cirujano Estéril Descartable' },
  { n: 36, code: 'KEN', description: 'Kit de Enfermera Estéril Descartable' },
  { n: 37, code: 'KIM', description: 'Kit de Cirujano Estéril Descartable con Mandil' },
  { n: 38, code: 'KIR', description: 'Kit de Ropa Cirujano Estéril Descartable' },
  { n: 39, code: 'KM2', description: 'Kit de Mandiles/Batas Estéril Descartable (02 Mandiles/Batas Quirúrgicas)' },
  { n: 39, code: 'KM3', description: 'Kit de Mandiles/Batas Estéril Descartable (03 Mandiles/Batas Quirúrgicas)' },
  { n: 39, code: 'KM4', description: 'Kit de Mandiles/Batas Estéril Descartable (04 Mandiles/Batas Quirúrgicas)' },
  { n: 40, code: 'KQ1', description: 'Kit de Mandiles Quirúrgicos Estéril Descartable con Toalla de mano (01 Mandil)' },
  { n: 40, code: 'KQ2', description: 'Kit de Mandiles Quirúrgicos Estéril Descartable con Toalla de mano (02 Mandiles)' },
  { n: 40, code: 'KQ3', description: 'Kit de Mandiles Quirúrgicos Estéril Descartable con Toalla de mano (03 Mandiles)' },
  { n: 40, code: 'KQ4', description: 'Kit de Mandiles Quirúrgicos Estéril Descartable con Toalla de mano (04 Mandiles)' },
  { n: 41, code: 'KB1', description: 'Kit de Batas Quirúrgicas Reforzadas Estéril Descartable con Toalla de Mano (01 Bata)' },
  { n: 41, code: 'KB2', description: 'Kit de Batas Quirúrgicas Reforzadas Estéril Descartable con Toalla de Mano (02 Batas)' },
  { n: 41, code: 'KB3', description: 'Kit de Batas Quirúrgicas Reforzadas Estéril Descartable con Toalla de Mano (03 Batas)' },
  { n: 41, code: 'KB4', description: 'Kit de Batas Quirúrgicas Reforzadas Estéril Descartable con Toalla de Mano (04 Batas)' },
  { n: 42, code: 'BOT', description: 'Bota Estéril Descartable' },
  { n: 43, code: 'STO', description: 'Stokinette / Cobertor de Extremidades Estéril Descartable' },
  { n: 44, code: 'PIR', description: 'Piernera / Legging Estéril Descartable' },
  { n: 45, code: 'VM-045', description: 'Mandil Quirúrgico Estéril Descartable' },
  { n: 46, code: 'VM-046', description: 'Mandil Estéril Descartable' },
  { n: 47, code: 'VM-047', description: 'Bata Quirúrgica Estéril Descartable' },
  { n: 48, code: 'VM-048', description: 'Bata Estéril Descartable' },
  { n: 49, code: 'VM-049', description: 'Mameluco Estéril Descartable' },
  { n: 50, code: 'VM-050', description: 'Overall Estéril Descartable' },
  { n: 51, code: 'VM-051', description: 'Mameluco con Capucha Estéril Descartable' },
  { n: 52, code: 'VM-052', description: 'Overall con Capucha Estéril Descartable' },
  { n: 53, code: 'VM-053', description: 'Mameluco con Cubrebota Estéril Descartable' },
  { n: 54, code: 'VM-054', description: 'Overall con Cubrebota Estéril Descartable' },
  { n: 55, code: 'VM-055', description: 'Mameluco con Cierre Estéril Descartable' },
  { n: 56, code: 'VM-056', description: 'Overall con Cierre Estéril Descartable' },
  { n: 57, code: 'VM-057', description: 'Stokinette Estéril Descartable' },
  { n: 58, code: 'VM-058', description: 'Cobertor de Extremidades Estéril Descartable' },
  { n: 59, code: 'VM-059', description: 'Piernera Estéril Descartable' },
  { n: 60, code: 'VM-060', description: 'Legging Estéril Descartable' },
  { n: 61, code: 'VM-061', description: 'Bata Reforzada en Pecho y Brazos Estéril Descartable' },
  { n: 62, code: 'VM-062', description: 'Bata Quirúrgica con Toalla de Mano Estéril Descartable' },
  { n: 63, code: 'VM-063', description: 'Bata Quirúrgica Reforzada Con Toalla De Mano Estéril Descartable' },
  { n: 64, code: 'VM-064', description: 'Bota Termolaminada Estéril Descartable' },
  { n: 65, code: 'VM-065', description: 'Bata Quirúrgica Estéril Descartable' },
  { n: 66, code: 'VM-066', description: 'Bata Quirúrgica Reforzada Estéril Descartable' },
  { n: 67, code: 'VM-067', description: 'Cinta Para Bota estéril Descartable' },
  { n: 68, code: 'VM-068', description: 'Mandil Quirúrgico con Refuerzo Estéril Descartable' },
  { n: 69, code: 'VM-069', description: 'Mandil Quirúrgico con Refuerzo Estéril Descartable con tarjeta de transferencia' },
  { n: 70, code: 'VM-070', description: 'Mandil Quirúrgico con Refuerzo en Pecho y Mangas Estéril Descartable' },
  { n: 71, code: 'VM-071', description: 'Mandil Quirúrgico Estéril Descartable con toalla de mano' },
  { n: 72, code: 'VM-072', description: 'Mandil Quirúrgico Estéril Descartable con toalla de mano y tarjeta de transferencia' },
  { n: 73, code: 'VM-073', description: 'Mandil Quirúrgico Estéril Descartable con tarjeta de transferencia' },
  { n: 74, code: 'VM-074', description: 'Mandil con refuerzo laminado' },
  { n: 75, code: 'VM-075', description: 'Mandil manga corta Quirúrgica Estéril Descartable' },
  { n: 76, code: 'VM-076', description: 'Mandil manga corta Estéril Descartable' },
  { n: 77, code: 'VM-077', description: 'Cubrecabello estéril descartable' },
  { n: 78, code: 'VM-078', description: 'Gorro Estéril Descartable' },
  { n: 79, code: 'VM-079', description: 'Mascarilla quirúrgica estéril descartable' },
  { n: 80, code: 'VM-080', description: 'Bata para cirujano Estéril Descartable' },
  { n: 81, code: 'VM-081', description: 'Bata para instrumentista Estéril Descartable' },
  { n: 82, code: 'VM-082', description: 'Batas Para Cirujano Impermeable Estéril Descartable' },
  { n: 83, code: 'VM-083', description: 'Kit de Cirujano Estéril Descartable (Chaqueta, Pantalón, Gorro de Cirujano, Par de Cubrecalzado, Mascarilla)' },
  { n: 84, code: 'VM-084', description: 'Kit de Enfermera Estéril Descartable (Chaqueta, Pantalón, Gorro de Enfermera, Par de Cubrecalzado, Mascarilla)' },
  { n: 85, code: 'VM-085', description: 'Kit de Cirujano Estéril Descartable con Mandil (Mandil Quirúrgico, Gorro de Cirujano, Par de Cubrecalzado, Mascarilla)' },
  { n: 86, code: 'VM-086', description: 'Kit de Ropa Cirujano Estéril Descartable (Chaqueta quirúrgica, Pantalón quirúrgico, Mandil Quirúrgico, Gorro de Cirujano, Par de Cubrecalzado, Mascarilla)' },
  { n: 87, code: 'VM-087', description: 'Kit Chaqueta-Pantalón Estéril Descartable (Chaqueta, Pantalón, Mascarilla)' },
  { n: 88, code: 'VM-088', description: 'Kit de Gorro, Cubrecalzado, Mascarilla Estéril Descartable' },
  { n: 89, code: 'VM-089', description: 'Chaqueta Estéril Descartable' },
  { n: 90, code: 'VM-090', description: 'Gorro quirúrgico Estéril Descartable - tipo Guasano' },
]

// --- DM0686N: Fundas, envoltorios y pisos estériles descartables ---------
const FUNDAS_ITEMS: SanitaryItemSeed[] = [
  { n: 1, code: 'FED', description: 'FUNDA ESTÉRIL DESCARTABLE' },
  { n: 2, code: 'FMM', description: 'FUNDA PARA MESA MAYO ESTÉRIL DESCARTABLE', productCode: 'PT-FMA-0001' },
  { n: 3, code: 'FML', description: 'FUNDA PARA MESA MEDIA LUNA ESTÉRIL DESCARTABLE', productCode: 'PT-FML-0001' },
  { n: 4, code: 'FMA', description: 'FUNDA PARA MESA ANGULADA ESTÉRIL DESCARTABLE' },
  { n: 5, code: 'FMQ', description: 'FUNDA PARA MESA QUIRÚRGICA ESTÉRIL DESCARTABLE' },
  { n: 6, code: 'FLE', description: 'FUNDA PARA LÁPIZ ELECTROCAUTERIO ESTÉRIL DESCARTABLE' },
  { n: 7, code: 'FEL', description: 'FUNDA PARA ELECTROCAUTERIO ESTÉRIL DESCARTABLE' },
  { n: 8, code: 'FCO', description: 'FUNDA RECOLECTORA ESTÉRIL DESCARTABLE' },
  { n: 9, code: 'FMI', description: 'FUNDA PARA MESA DE INSTRUMENTACIÓN ESTÉRIL DESCARTABLE' },
  { n: 10, code: 'FRE', description: 'FUNDA REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 11, code: 'FRM', description: 'FUNDA PARA MESA MAYO REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 12, code: 'FRL', description: 'FUNDA PARA MESA MEDIA LUNA REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 13, code: 'FRA', description: 'FUNDA PARA MESA ANGULADA REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 14, code: 'FRQ', description: 'FUNDA PARA MESA QUIRÚRGICA REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 15, code: 'FER', description: 'FUNDA PARA LÁPIZ ELECTROCAUTERIO REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 16, code: 'FRL', description: 'FUNDA PARA ELECTROCAUTERIO REFORZADA ESTÉRIL DESCARTABLE', notes: 'El PDF original reutiliza el código FRL, ya usado en el ítem 12 — se transcribe tal como figura en la resolución.' },
  { n: 17, code: 'FRC', description: 'FUNDA RECOLECTORA REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 18, code: 'FRI', description: 'FUNDA PARA MESA DE INSTRUMENTACIÓN REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 19, code: 'FDE', description: 'FUNDA CON DOBLES Y REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 20, code: 'FDM', description: 'FUNDA PARA MESA MAYO CON DOBLES Y REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 21, code: 'FDL', description: 'FUNDA PARA MESA MEDIA LUNA CON DOBLES Y REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 22, code: 'FDA', description: 'FUNDA PARA MESA ANGULADA CON DOBLES Y REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 23, code: 'FDQ', description: 'FUNDA PARA MESA QUIRÚRGICA CON DOBLES Y REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 24, code: 'FDR', description: 'FUNDA PARA LÁPIZ ELECTROCAUTERIO CON DOBLES Y REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 25, code: 'FDD', description: 'FUNDA PARA ELECTROCAUTERIO CON DOBLES Y REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 26, code: 'FDC', description: 'FUNDA RECOLECTORA CON DOBLES Y REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 27, code: 'FDI', description: 'FUNDA PARA MESA DE INSTRUMENTACIÓN CON DOBLES Y REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 28, code: 'FBE', description: 'FUNDA QUIRÚRGICA ESTÉRIL DESCARTABLE REFORZADO CON DOBLES Y REFORZADO' },
  { n: 29, code: 'FBM', description: 'FUNDA QUIRÚRGICA REFORZADO CON DOBLES Y REFORZADO PARA MESA MAYO ESTÉRIL DESCARTABLE' },
  { n: 30, code: 'FBL', description: 'FUNDA QUIRÚRGICA REFORZADO CON DOBLES Y REFORZADO PARA MESA MEDIA LUNA ESTÉRIL DESCARTABLE' },
  { n: 31, code: 'FBA', description: 'FUNDA QUIRÚRGICA REFORZADO CON DOBLES Y REFORZADO PARA MESA ANGULADA ESTÉRIL DESCARTABLE' },
  { n: 32, code: 'FBQ', description: 'FUNDA QUIRÚRGICA REFORZADO CON DOBLES Y REFORZADO PARA MESA QUIRÚRGICA ESTÉRIL DESCARTABLE' },
  { n: 33, code: 'FBR', description: 'FUNDA QUIRÚRGICA REFORZADO CON DOBLES Y REFORZADO PARA LÁPIZ ELECTROCAUTERIO ESTÉRIL DESCARTABLE' },
  { n: 34, code: 'FBZ', description: 'FUNDA QUIRÚRGICA REFORZADO CON DOBLES Y REFORZADO PARA ELECTROCAUTERIO ESTÉRIL DESCARTABLE' },
  { n: 35, code: 'FBC', description: 'FUNDA QUIRÚRGICA REFORZADO CON DOBLES Y REFORZADO RECOLECTORA ESTÉRIL DESCARTABLE' },
  { n: 36, code: 'FBF', description: 'FUNDA QUIRÚRGICA REFORZADO CON DOBLES Y REFORZADO PARA MESA DE INSTRUMENTACIÓN ESTÉRIL DESCARTABLE' },
  { n: 37, code: 'BLA', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE PARA LÁPIZ ELECTROCAUTERIO' },
  { n: 38, code: 'BEL', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE PARA ELECTROCAUTERIO' },
  { n: 39, code: 'BRL', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE REFORZADO PARA LÁPIZ ELECTROCAUTERIO' },
  { n: 40, code: 'BRE', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE REFORZADO PARA ELECTROCAUTERIO' },
  { n: 41, code: 'BDZ', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE CON DOBLES Y REFORZADO PARA LÁPIZ ELECTROCAUTERIO' },
  { n: 42, code: 'BDL', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE CON DOBLES Y REFORZADO PARA ELECTROCAUTERIO' },
  { n: 43, code: 'BDR', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE REFORZADO CON DOBLES Y REFORZADO PARA LÁPIZ ELECTROCAUTERIO' },
  { n: 44, code: 'BDE', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE REFORZADO CON DOBLES Y REFORZADO PARA ELECTROCAUTERIO' },
  { n: 45, code: 'BDT', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE RECOLECTORA' },
  { n: 46, code: 'BCO', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE REFORZADO RECOLECTORA' },
  { n: 47, code: 'DRC', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE CON DOBLES Y REFORZADO RECOLECTORA' },
  { n: 48, code: 'BDC', description: 'BOLSA QUIRÚRGICA ESTÉRIL DESCARTABLE REFORZADO CON DOBLES Y REFORZADO RECOLECTORA' },
  { n: 49, code: 'PSO', description: 'PISO ESTÉRIL DESCARTABLE' },
  { n: 50, code: 'PMM', description: 'PISO PARA MESA DE MAYO ESTÉRIL DESCARTABLE' },
  { n: 51, code: 'PSA', description: 'PISO SIMPLE PARA MESA MAYO/ PISO SIMPLE PARA MESA ESTERIL DESCARTABLE' },
  { n: 52, code: 'PMD', description: 'PISO PARA MESA DE MAYO DOBLE (Con refuerzo) ESTÉRIL DESCARTABLE' },
  { n: 53, code: 'PRM', description: 'PISO REFORZADO PARA MESA MAYO ESTÉRIL DESCARTABLE' },
  { n: 54, code: 'PDR', description: 'PISO DOBLE REFORZADO PARA MESA MAYO ESTÉRIL DESCARTABLE' },
  { n: 55, code: 'CQD', description: 'CUBREMESA QUIRÚRGICA DOBLE (Con refuerzo) ESTÉRIL Descartable' },
  { n: 56, code: 'AQA', description: 'CUBREMESA QUIRÚRGICA ACOLCHADA Estéril Descartable' },
  { n: 57, code: 'CQE', description: 'CUBREMESA ANGULADA Estéril Descartable' },
  { n: 58, code: 'CAE', description: 'CUBIERTA ANGULADA PARA MESA DE MAYO Estéril Descartable' },
  { n: 59, code: 'CMM', description: 'CUBIERTA PARA MESA DE MAYO Estéril Descartable' },
  { n: 60, code: 'CMI', description: 'CUBIERTA PARA MESA DE INSTRUMENTACION QUIRÚRGICA Estéril Descartable' },
  { n: 61, code: 'EDE', description: 'ENVOLTORIO DESCARTABLE ESTÉRIL' },
  { n: 62, code: 'COF', description: 'FUNDA / BOLSA/BOLSA COLECTORA ESTÉRIL DESCARTABLE' },
  { n: 63, code: 'BFT', description: 'FUNDA / BOLSA PARA LÁPIZ DE ELECTROCAUTERIO ESTÉRIL DESCARTABLE' },
  { n: 64, code: 'BFD', description: 'FUNDA DOBLE / BOLSA DOBLE PARA LÁPIZ DE ELECTROCAUTERIO ESTÉRIL DESCARTABLE' },
  { n: 65, code: 'RLZ', description: 'FUNDA REFORZADA / BOLSA REFORZADA PARA LÁPIZ DE ELECTROCAUTERIO ESTÉRIL DESCARTABLE' },
  { n: 66, code: 'FSO', description: 'FUNDA/BOLSA PARA ELECTRODOS ESTÉRIL DESCARTABLE' },
  { n: 67, code: 'MAF', description: 'FUNDA/BOLSA PARA MANGERA ESTÉRIL DESCARTABLE' },
  { n: 68, code: 'CRF', description: 'FUNDA / BOLSA RECOLECTORA ESTÉRIL DESCARTABLE' },
  { n: 69, code: 'FEP', description: 'FUNDA/ MANGA LAPAROTOMÍA ESTÉRIL DESCARTABLE' },
  { n: 70, code: 'EFR', description: 'FUNDA/ MANGA LAPAROSCÓPICA ESTÉRIL DESCARTABLE' },
  { n: 71, code: 'FAR', description: 'FUNDA / MANGA ARTROSCÓPICA ESTÉRIL DESCARTABLE' },
  { n: 72, code: 'FPM', description: 'FUNDA/CUBIERTA PARA MESA MAYO ESTÉRIL DESCARTABLE' },
  { n: 73, code: 'FBI', description: 'FUNDA/CUBIERTA PARA MESA MAYO DOBLE ESTÉRIL DESCARTABLE' },
  { n: 74, code: 'FCF', description: 'FUNDA/CUBIERTA PARA MESA MAYO REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 75, code: 'FCM', description: 'FUNDA/CUBIERTA PARA MESA DE INSTRUMENTACION QUIRÚRGICA ESTÉRIL DESCARTABLE' },
  { n: 76, code: 'FCB', description: 'FUNDA/CUBIERTA PARA MESA DE INSTRUMENTACION QUIRÚRGICA DOBLE ESTÉRIL DESCARTABLE' },
  { n: 77, code: 'FCI', description: 'FUNDA/CUBIERTA PARA MESA DE INSTRUMENTACION QUIRÚRGICA REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 78, code: 'FCH', description: 'FUNDA/CUBIERTA DE MESA CON ALMOHADILLA ABSORBENTE ESTÉRIL DESCARTABLE' },
  { n: 79, code: 'SOF', description: 'FUNDA / CUBREMESA QUIRÚRGICA ESTÉRIL DESCARTABLE' },
  { n: 80, code: 'FCD', description: 'FUNDA/CUBREMESA QUIRÚRGICA DOBLE/CUBREMESA DOBLE ESTÉRIL DESCARTABLE' },
  { n: 81, code: 'FCR', description: 'FUNDA/CUBREMESA QUIRÚRGICA REFORZADA/CUBREMESA REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 82, code: 'FCA', description: 'FUNDA / CUBREMESA QUIRÚRGICA ACOLCHADA ESTÉRIL DESCARTABLE' },
  { n: 83, code: 'FCL', description: 'FUNDA/CUBREMESA PARA MESA MEDIA LUNA ESTÉRIL DESCARTABLE' },
  { n: 84, code: 'ACF', description: 'FUNDA / CUBREMESA PARA MESA ANGULADA ESTÉRIL DESCARTABLE' },
  { n: 85, code: 'F-085', description: 'FUNDA / BOLSA PARA SUTURAS ESTÉRIL DESCARTABLE' },
  { n: 86, code: 'F-086', description: 'FUNDA / BOLSA PORTÁTIL ESTÉRIL DESCARTABLE' },
  { n: 87, code: 'F-087', description: 'FUNDA / BOLSA RECOLECTORA CON ADHESIVO ESTÉRIL DESCARTABLE' },
  { n: 88, code: 'F-088', description: 'FUNDA / BOLSA PARA FRASCO 1000 CC ESTÉRIL DESCARTABLE' },
  { n: 89, code: 'F-089', description: 'FUNDA / BOLSA PARA FRASCO 100 CC ESTÉRIL DESCARTABLE' },
  { n: 90, code: 'F-090', description: 'FUNDA / BOLSA PARA FRASCO 250 CC ESTÉRIL DESCARTABLE' },
  { n: 91, code: 'F-091', description: 'FUNDA / BOLSA PARA FRASCO 500 CC ESTÉRIL DESCARTABLE' },
  { n: 92, code: 'F-092', description: 'FUNDA PARA MESA DE MAYO ESTÉRIL DESCARTABLE' },
  { n: 93, code: 'F-093', description: 'FUNDA DE MESA DE MAYO REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 94, code: 'F-094', description: 'FUNDA DE MESA INSTRUMENTAL REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 95, code: 'F-095', description: 'FUNDA PARA MESA MAYO CON REFUERZO EN LA PARTE SUPERIOR ESTÉRIL DESCARTABLE' },
  { n: 96, code: 'F-096', description: 'FUNDA PARA MESA MAYO CON REFUERZO EN LA PARTE INFERIOR ESTÉRIL DESCARTABLE' },
  { n: 97, code: 'F-097', description: 'FUNDA PARA MESA MAYO CON REFUERZO EN LA PARTE LATERAL ESTÉRIL DESCARTABLE' },
  { n: 98, code: 'F-098', description: 'CUBIERTA PARA MESA DE RIÑÓN ESTÉRIL DESCARTABLE' },
  { n: 99, code: 'F-099', description: 'CUBIERTA DEL STAND DE MAYO ESTÉRIL DESCARTABLE' },
  { n: 100, code: 'F-100', description: 'CUBIERTA PARA MESA RIÑÓN ESTÉRIL DESCARTABLE' },
  { n: 101, code: 'F-101', description: 'CUBIERTA SET UP ESTÉRIL DESCARTABLE' },
  { n: 102, code: 'F-102', description: 'CUBREMANGUERAS ESTÉRIL DESCARTABLE' },
  { n: 103, code: 'F-103', description: 'COBERTOR PARA MESA REFORZADO ESTÉRIL DESCARTABLE' },
  { n: 104, code: 'F-104', description: 'COBERTOR PARA MESA MAYO DE REFORZADO ABSORBENTE ESTÉRIL DESCARTABLE' },
  { n: 105, code: 'F-105', description: 'FUNDA CUBREBRAZO ESTÉRIL DESCARTABLE' },
  { n: 106, code: 'F-106', description: 'FUNDA CRISTAL PARA LÁMPARA ESTÉRIL DESCARTABLE' },
  { n: 107, code: 'F-107', description: 'TAPETE ESTÉRIL DESCARTABLE' },
  { n: 108, code: 'F-108', description: 'SOBRE MESA CON REFUERZO LAMINADO' },
  { n: 109, code: 'F-109', description: 'PISO DOBLE PARA MESA MAYO ESTÉRIL DESCARTABLE' },
  { n: 110, code: 'F-110', description: 'SOLERA ESTÉRIL DESCARTABLE' },
  { n: 111, code: 'F-111', description: 'ENVOLTORIO DOBLE CON REFUERZO ESTÉRIL DESCARTABLE' },
  { n: 112, code: 'F-112', description: 'ENVOLTORIO CON REFUERZO ESTÉRIL DESCARTABLE' },
  { n: 113, code: 'F-113', description: 'FUNDA PARA SILLÓN DENTAL ESTÉRIL DESCARTABLE' },
  { n: 114, code: 'F-114', description: 'SOLERA QUIRÚRGICO ESTÉRIL DESCARTABLE' },
  { n: 115, code: 'F-115', description: 'FUNDA MEDIA LUNA ESTÉRIL DESCARTABLE' },
  { n: 116, code: 'F-116', description: 'FUNDA MEDIA LUNA REFORZADA ESTÉRIL DESCARTABLE' },
  { n: 117, code: 'F-117', description: 'FUNDA MEDIA LUNA DOBLE ESTÉRIL DESCARTABLE' },
  { n: 118, code: 'F-118', description: 'FUNDA MEDIA LUNA SIMPLE ESTÉRIL DESCARTABLE' },
  { n: 119, code: 'F-119', description: 'FUNDA PARA PANTALLA ESTÉRIL DESCARTABLE' },
  { n: 120, code: 'F-120', description: 'FUNDA PROTECTORA DE PANTALLA ESTÉRIL DESCARTABLE' },
  { n: 121, code: 'F-121', description: 'ENVOLTORIO ESTÉRIL DESCARTABLE' },
  { n: 122, code: 'F-122', description: 'ENVOLTORIO PARA KIT ESTÉRIL DESCARTABLE' },
  { n: 123, code: 'F-123', description: 'FUNDA MEDIA LUNA DOBLE REFORZADA ESTÉRIL DESCARTABLE' },
]

// --- DM0812N: Toallas, paños quirúrgicos estériles descartables ----------
const TOALLAS_ITEMS: SanitaryItemSeed[] = [
  { n: 1, code: 'TOA-001', description: 'TOALLA SECANTE ESTERIL DESCARTABLE' },
  { n: 2, code: 'TOA-002', description: 'TOALLA ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 3, code: 'TOA-003', description: 'TOALLA DE MANO ESTERIL DESCARTABLE' },
  { n: 4, code: 'TOA-004', description: 'TOALLA PARA CIRUJANO ESTERIL DESCARTABLE' },
  { n: 5, code: 'TOA-005', description: 'TOALLA MEDICO ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 6, code: 'TOA-006', description: 'TOALLA MEDICO ABSORBENTE PARA SECADO DE MANOS ESTERIL DESCARTABLE' },
  { n: 7, code: 'TOA-007', description: 'TOALLA PARA MANOS CON CELULOSA ESTERIL DESCARTABLE' },
  { n: 8, code: 'TOA-008', description: 'TOALLA ESTERIL DESCARTABLE' },
  { n: 9, code: 'TOA-009', description: 'TOALLA QUIRURGICA ESTERIL DESCARTABLE', productCode: 'PT-TOA-0001' },
  { n: 10, code: 'TOA-010', description: 'TOALLA DE SECADO PARA MANOS ESTERIL DESCARTABLE' },
  { n: 11, code: 'TOA-011', description: 'TOALLAS PARA MANOS DE CELULOSA BLANCAS DE DOBLE CARA ESTERIL DESCARTABLE' },
  { n: 12, code: 'TOA-012', description: 'TOALLAS DE SECADO PARA MANOS ESTERIL DESCARTABLE' },
  { n: 13, code: 'TOA-013', description: 'TOALLA / TOALLITA PEQUEÑA ESTERIL DESCARTABLE' },
  { n: 14, code: 'TOA-014', description: 'TOALLA LIBRE DE PELUSAS ESTERIL DESCARTABLE' },
  { n: 15, code: 'TOA-015', description: 'TOALLA SECADO INSTRUMENTAL QUIRURGICO ESTERIL DESCARTABLE' },
  { n: 16, code: 'TOA-016', description: 'TOALLA SECADO CAJAS QUIRURGICAS ESTERIL DESCARTABLE' },
  { n: 17, code: 'TOA-017', description: 'TOALLA PROTECCION DE MESONES ESTERIL DESCARTABLE' },
  { n: 18, code: 'TOA-018', description: 'TOALLAS DESINFECTANTE DE SUPERFICIES ESTERIL DESCARTABLE' },
  { n: 19, code: 'TOA-019', description: 'TOALLA DE PROTECCION DE MESONES ESTERIL DESCARTABLE' },
  { n: 20, code: 'TOA-020', description: 'TOALLA / PAÑO SECANTE ESTERIL DESCARTABLE' },
  { n: 21, code: 'TOA-021', description: 'TOALLA / PAÑO ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 22, code: 'TOA-022', description: 'TOALLA / PAÑO DE MANOS ESTERIL DESCARTABLE' },
  { n: 23, code: 'TOA-023', description: 'TOALLA / PAÑO PARA CIRUJANO ESTERIL DESCARTABLE' },
  { n: 24, code: 'TOA-024', description: 'TOALLA / PAÑO MEDICO ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 25, code: 'TOA-025', description: 'TOALLA / PAÑO MEDICO ABSORBENTE PARA SECADO DE MANOS ESTERIL DESCARTABLE' },
  { n: 26, code: 'TOA-026', description: 'TOALLA / PAÑO PARA MANOS CON CELULOSA ESTERIL DESCARTABLE' },
  { n: 27, code: 'TOA-027', description: 'TOALLA / PAÑO ESTERIL DESCARTABLE' },
  { n: 28, code: 'TOA-028', description: 'TOALLA / PAÑO QUIRURGICO ESTERIL DESCARTABLE' },
  { n: 29, code: 'TOA-029', description: 'TOALLA / PAÑO DE SECADO PARA MANOS ESTERIL DESCARTABLE' },
  { n: 30, code: 'TOA-030', description: 'TOALLA / PAÑO PARA MANOS DE CELULOSA BLANCAS DE DOBLE CARA ESTERIL DESCARTABLE' },
  { n: 31, code: 'TOA-031', description: 'TOALLA / PAÑO DE SECADO PARA MANOS ESTERIL DESCARTABLE' },
  { n: 32, code: 'TOA-032', description: 'TOALLA / TOALLITA PEQUEÑA ESTERIL DESCARTABLE' },
  { n: 33, code: 'TOA-033', description: 'TOALLA / PAÑO LIBRE DE PELUSAS ESTERIL DESCARTABLE' },
  { n: 34, code: 'TOA-034', description: 'TOALLA / PAÑO SECADO INSTRUMENTAL QUIRURGICO ESTERIL DESCARTABLE' },
  { n: 35, code: 'TOA-035', description: 'TOALLA / PAÑO SECADO CAJAS QUIRURGICAS ESTERIL DESCARTABLE' },
  { n: 36, code: 'TOA-036', description: 'TOALLA / PAÑO PROTECCION DE MESONES ESTERIL DESCARTABLE' },
  { n: 37, code: 'TOA-037', description: 'TOALLA / PAÑO DESINFECTANTE DE SUPERFICIES ESTERIL DESCARTABLE' },
  { n: 38, code: 'TOA-038', description: 'TOALLA / PAÑO DE PROTECCION DE MESONES ESTERIL DESCARTABLE' },
  { n: 39, code: 'TOA-039', description: 'PAÑO SECANTE ESTERIL DESCARTABLE' },
  { n: 40, code: 'TOA-040', description: 'PAÑO ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 41, code: 'TOA-041', description: 'PAÑO DE MANOS ESTERIL DESCARTABLE' },
  { n: 42, code: 'TOA-042', description: 'PAÑO PARA CIRUJANO ESTERIL DESCARTABLE' },
  { n: 43, code: 'TOA-043', description: 'PAÑO MEDICO ABSORBENTE ESTERIL DESCARTABLE' },
  { n: 44, code: 'TOA-044', description: 'PAÑO MEDICO ABSORBENTE PARA SECADO DE MANOS ESTERIL DESCARTABLE' },
  { n: 45, code: 'TOA-045', description: 'PAÑO PARA MANOS CON CELULOSA ESTERIL DESCARTABLE' },
  { n: 46, code: 'TOA-046', description: 'PAÑO ESTERIL DESCARTABLE' },
  { n: 47, code: 'TOA-047', description: 'PAÑO QUIRURGICO ESTERIL DESCARTABLE' },
  { n: 48, code: 'TOA-048', description: 'PAÑO DE SECADO PARA MANOS ESTERIL DESCARTABLE' },
  { n: 49, code: 'TOA-049', description: 'PAÑO PARA MANOS DE CELULOSA BLANCAS DE DOBLE CARA ESTERIL DESCARTABLE' },
  { n: 50, code: 'TOA-050', description: 'PAÑO DE SECADO PARA MANOS ESTERIL DESCARTABLE' },
  { n: 51, code: 'TOA-051', description: 'PAÑO PEQUEÑA ESTERIL DESCARTABLE' },
  { n: 52, code: 'TOA-052', description: 'PAÑO LIBRE DE PELUSAS ESTERIL DESCARTABLE' },
  { n: 53, code: 'TOA-053', description: 'PAÑO SECADO INSTRUMENTAL QUIRURGICO ESTERIL DESCARTABLE' },
  { n: 54, code: 'TOA-054', description: 'PAÑO SECADO CAJAS QUIRURGICAS ESTERIL DESCARTABLE' },
  { n: 55, code: 'TOA-055', description: 'PAÑO PROTECCION DE MESONES ESTERIL DESCARTABLE' },
  { n: 56, code: 'TOA-056', description: 'PAÑO DESINFECTANTE DE SUPERFICIES ESTERIL DESCARTABLE' },
  { n: 57, code: 'TOA-057', description: 'PAÑO DE PROTECCION DE MESONES ESTERIL DESCARTABLE' },
]

const SANITARY_REGISTRATIONS: SanitaryRegistrationSeed[] = [
  {
    code: 'RS-DM0682N',
    registrationNumber: 'DM0682N',
    title: 'CAMPOS, PONCHOS, CUBREMESA Y SABANAS QUIRURGICAS ESTERILES DESCARTABLES',
    medicalDeviceClass: 'CLASE I (DE BAJO RIESGO)',
    issuingAuthority: 'DIGEMID',
    manufacturer: 'BIOSAFE INDUSTRIES S.A.C.',
    country: 'PERÚ',
    brand: 'BIOSAFE',
    issueDate: new Date('2023-03-22'),
    expirationDate: new Date('2028-03-22'),
    notes:
      'Digitalizado a partir del expediente PDF original (docs/R.S. CAMPOS, PONCHOS, CUBREMESA Y SABANAS 2026.pdf). ' +
      'Datos extraídos por revisión visual de cada página, no por OCR automático. Ítems transcritos textualmente ' +
      'tal como figuran en las resoluciones — validar contra el original antes de cualquier uso regulatorio real.',
    items: CAMPOS_ITEMS,
    changes: [
      {
        resolutionNumber: 'R.D. N° 1826-2023/DIGEMID/DDMP/EDM/MINSA',
        changeType: 'INSCRIPCION',
        resolutionDate: new Date('2023-03-24'),
        description:
          'Inscripción original en el Registro Sanitario del dispositivo médico de la Clase I (de bajo riesgo): ' +
          'Campos, Ponchos, Cubremesa y Sábanas Quirúrgicas Estériles Descartables. Vigencia del 22-03-2023 al 22-03-2028. 115 ítems autorizados.',
      },
      {
        resolutionNumber: 'R.D. N° 866-2025/DIGEMID/DDMP/EDM/MINSA',
        changeType: 'MODIFICACION',
        resolutionDate: new Date('2025-02-05'),
        description: 'Cambio en el Registro Sanitario: inclusión de nuevos códigos C-116 a C-217 (102 ítems adicionales).',
      },
      {
        resolutionNumber: 'R.D. N° 6992-2026/DIGEMID/DDMP/EDM/MINSA',
        changeType: 'ACTUALIZACION',
        resolutionDate: new Date('2026-08-07'),
        description:
          'Cambio en el Registro Sanitario: inclusión de color e información contenida en el rotulado ' +
          '(colores azul quirúrgico, celeste quirúrgico y verde quirúrgico) para los ítems 1 a 115 del registro original. No agrega códigos nuevos.',
      },
    ],
    documentFile: 'DM0682N-RS-campos-ponchos-cubremesa-sabanas.pdf',
    documentType: 'EXPEDIENTE_REGISTRO_SANITARIO',
    documentDate: new Date('2026-08-07'),
  },
  {
    code: 'RS-DM0684N',
    registrationNumber: 'DM0684N',
    title: 'VESTUARIO MEDICO/ ROPA QUIRURGICA ESTERIL DESCARTABLE',
    medicalDeviceClass: 'CLASE I (DE BAJO RIESGO)',
    issuingAuthority: 'DIGEMID',
    manufacturer: 'BIOSAFE INDUSTRIES S.A.C.',
    country: 'PERÚ',
    brand: 'BIOSAFE',
    issueDate: new Date('2023-04-04'),
    expirationDate: new Date('2028-04-04'),
    notes:
      'Digitalizado a partir del expediente PDF original (docs/R.S. VESTUARIO MEDICO - ROPA QUIRÚRGICA ESTERIL DESCARTABLE - BIOSAFE.pdf). ' +
      'Datos extraídos por revisión visual de cada página, no por OCR automático — validar contra el original antes de cualquier uso regulatorio real.',
    items: VESTUARIO_ITEMS,
    changes: [
      {
        resolutionNumber: 'R.D. N° 2182-2023/DIGEMID/DDMP/EDM/MINSA',
        changeType: 'INSCRIPCION',
        resolutionDate: new Date('2023-04-05'),
        description:
          'Inscripción original en el Registro Sanitario del dispositivo médico de la Clase I (de bajo riesgo): ' +
          'Vestuario Médico/Ropa Quirúrgica Estéril Descartable. Vigencia del 04-04-2023 al 04-04-2028. 44 ítems autorizados.',
      },
      {
        resolutionNumber: 'R.D. N° 173-2025/DIGEMID/DDMP/EDM/MINSA',
        changeType: 'MODIFICACION',
        resolutionDate: new Date('2025-01-09'),
        description: 'Cambio en el Registro Sanitario: inclusión de nuevos códigos VM-045 a VM-090 (46 ítems adicionales).',
      },
    ],
    documentFile: 'DM0684N-RS-vestuario-medico-ropa-quirurgica.pdf',
    documentType: 'EXPEDIENTE_REGISTRO_SANITARIO',
    documentDate: new Date('2025-01-09'),
  },
  {
    code: 'RS-DM0686N',
    registrationNumber: 'DM0686N',
    title: 'FUNDAS, ENVOLTORIOS, PISOS ESTERILES DESCARTABLES',
    medicalDeviceClass: 'CLASE I (DE BAJO RIESGO)',
    issuingAuthority: 'DIGEMID',
    manufacturer: 'BIOSAFE INDUSTRIES S.A.C.',
    country: 'PERÚ',
    brand: 'BIOSAFE',
    issueDate: new Date('2023-04-12'),
    expirationDate: new Date('2028-04-12'),
    notes:
      'Digitalizado a partir del expediente PDF original (docs/R.S. FUNDAS, ENVOLTORIO, PISOS - BIOSAFE.pdf). ' +
      'Datos extraídos por revisión visual de cada página, no por OCR automático — validar contra el original antes de cualquier uso regulatorio real.',
    items: FUNDAS_ITEMS,
    changes: [
      {
        resolutionNumber: 'R.D. N° 2384-2023/DIGEMID/DDMP/EDM/MINSA',
        changeType: 'INSCRIPCION',
        resolutionDate: new Date('2023-04-14'),
        description:
          'Inscripción original en el Registro Sanitario del dispositivo médico de la Clase I (de bajo riesgo): ' +
          'Fundas, Envoltorios, Pisos Estériles Descartables. Vigencia del 12-04-2023 al 12-04-2028. 84 ítems autorizados.',
      },
      {
        resolutionNumber: 'R.D. N° 181-2025/DIGEMID/DDMP/EDM/MINSA',
        changeType: 'MODIFICACION',
        resolutionDate: new Date('2025-01-10'),
        description: 'Cambio en el Registro Sanitario: inclusión de nuevos códigos F-085 a F-123 (39 ítems adicionales).',
      },
    ],
    documentFile: 'DM0686N-RS-fundas-envoltorio-pisos.pdf',
    documentType: 'EXPEDIENTE_REGISTRO_SANITARIO',
    documentDate: new Date('2025-01-10'),
  },
  {
    code: 'RS-DM0812N',
    registrationNumber: 'DM0812N',
    title: 'TOALLAS, PAÑOS QUIRURGICAS ESTERILES DESCARTABLES',
    medicalDeviceClass: 'CLASE I (DE BAJO RIESGO)',
    issuingAuthority: 'DIGEMID',
    manufacturer: 'BIOSAFE INDUSTRIES S.A.C.',
    country: 'PERÚ',
    brand: 'BIOSAFE',
    issueDate: new Date('2025-04-24'),
    expirationDate: new Date('2030-04-24'),
    notes:
      'Digitalizado a partir del expediente PDF original (docs/R.S. TOALLAS.pdf), que incluye también el Certificado ' +
      'de Libre Comercialización N° 060 (29-05-2025) para el mismo Registro Sanitario. Datos extraídos por revisión ' +
      'visual, no por OCR automático — validar contra el original antes de cualquier uso regulatorio real.',
    items: TOALLAS_ITEMS,
    changes: [
      {
        resolutionNumber: 'R.D. N° 4258-2025/DIGEMID/DDMP/EDM/MINSA',
        changeType: 'INSCRIPCION',
        resolutionDate: new Date('2025-04-25'),
        description:
          'Inscripción original en el Registro Sanitario del dispositivo médico de la Clase I (de bajo riesgo): ' +
          'Toallas, Paños Quirúrgicas Estériles Descartables. Vigencia del 24-04-2025 al 24-04-2030. 57 ítems autorizados. ' +
          'Incluye Certificado de Libre Comercialización N° 060 emitido el 29-05-2025.',
      },
    ],
    documentFile: 'DM0812N-RS-toallas.pdf',
    documentType: 'EXPEDIENTE_REGISTRO_SANITARIO',
    documentDate: new Date('2025-04-25'),
  },
]

async function seedSanitaryRegistrations() {
  for (const entry of SANITARY_REGISTRATIONS) {
    const registration = await prisma.sanitaryRegistration.upsert({
      where: { registrationNumber: entry.registrationNumber },
      update: {
        code: entry.code,
        title: entry.title,
        medicalDeviceClass: entry.medicalDeviceClass,
        issuingAuthority: entry.issuingAuthority,
        manufacturer: entry.manufacturer,
        country: entry.country,
        brand: entry.brand,
        issueDate: entry.issueDate,
        expirationDate: entry.expirationDate,
        status: 'VALID',
        notes: entry.notes,
      },
      create: {
        code: entry.code,
        registrationNumber: entry.registrationNumber,
        title: entry.title,
        medicalDeviceClass: entry.medicalDeviceClass,
        issuingAuthority: entry.issuingAuthority,
        manufacturer: entry.manufacturer,
        country: entry.country,
        brand: entry.brand,
        issueDate: entry.issueDate,
        expirationDate: entry.expirationDate,
        status: 'VALID',
        notes: entry.notes,
      },
    })

    await prisma.sanitaryRegistrationItem.deleteMany({ where: { sanitaryRegistrationId: registration.id } })
    for (const item of entry.items) {
      const product = item.productCode
        ? await prisma.product.findUnique({ where: { code: item.productCode } })
        : null
      await prisma.sanitaryRegistrationItem.create({
        data: {
          sanitaryRegistrationId: registration.id,
          officialItemNumber: item.n,
          officialCode: item.code,
          officialDescription: item.description,
          productId: product?.id,
          notes: item.notes,
        },
      })
    }

    await prisma.sanitaryRegistrationChange.deleteMany({ where: { sanitaryRegistrationId: registration.id } })
    for (const change of entry.changes) {
      await prisma.sanitaryRegistrationChange.create({
        data: {
          sanitaryRegistrationId: registration.id,
          resolutionNumber: change.resolutionNumber,
          changeType: change.changeType,
          resolutionDate: change.resolutionDate,
          effectiveDate: change.resolutionDate,
          description: change.description,
          notes: change.notes,
        },
      })
    }

    const documentPath = path.join(SANITARY_UPLOAD_DIR, entry.documentFile)
    if (!fs.existsSync(documentPath)) {
      throw new Error(
        `No se encontró el PDF original "${entry.documentFile}" en ${SANITARY_UPLOAD_DIR}. ` +
          'Copia el archivo real desde docs/ antes de sembrar (no se generan documentos sintéticos).',
      )
    }
    const existingDocument = await prisma.sanitaryRegistrationDocument.findFirst({
      where: { sanitaryRegistrationId: registration.id, storagePath: entry.documentFile },
    })
    if (!existingDocument) {
      const stats = fs.statSync(documentPath)
      await prisma.sanitaryRegistrationDocument.create({
        data: {
          sanitaryRegistrationId: registration.id,
          fileName: entry.documentFile,
          storagePath: entry.documentFile,
          mimeType: 'application/pdf',
          fileSize: stats.size,
          documentType: entry.documentType,
          documentDate: entry.documentDate,
        },
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Iteración 12 — Rendimiento de Mandiles por Rollo de Tela. Fuente real:
// docs/rendimiento de mandiles.xlsx (validada visualmente contra el archivo,
// no transcrita de memoria). Dato de PLANEAMIENTO (rollos de tela por OP):
// no reemplaza la BOM ni la ficha técnica, y no altera la explosión de BOM
// ni cantidades de OP ya generadas — ver `ProductMaterialYield` en el
// schema.
// ---------------------------------------------------------------------------

interface MaterialYieldSeed {
  productCode: string
  rawMaterialCode: string
  cutWidth: number
  cutLength: number
  unitsPerRoll: number
  sourceRollWidth: number
  sourceRollLength: number
  sourceGrammage: number
}

// Los 12 rendimientos del Excel (4 tallas × 3 gramajes), transcritos tal
// cual de la hoja "rendimiento mandiles".
const MANDIL_MATERIAL_YIELDS: MaterialYieldSeed[] = [
  // Talla S
  { productCode: 'PT-MQS-0001', rawMaterialCode: 'TELA-SMS-40', cutWidth: 115, cutLength: 145, unitsPerRoll: 2640, sourceRollWidth: 2.1, sourceRollLength: 2800, sourceGrammage: 40 },
  { productCode: 'PT-MQS-0001', rawMaterialCode: 'TELA-SMS-35', cutWidth: 115, cutLength: 145, unitsPerRoll: 2750, sourceRollWidth: 2.1, sourceRollLength: 3200, sourceGrammage: 35 },
  { productCode: 'PT-MQS-0001', rawMaterialCode: 'TELA-SMS-45', cutWidth: 115, cutLength: 145, unitsPerRoll: 2180, sourceRollWidth: 2.1, sourceRollLength: 2400, sourceGrammage: 45 },
  // Talla M
  { productCode: 'PT-MQM-0002', rawMaterialCode: 'TELA-SMS-40', cutWidth: 120, cutLength: 150, unitsPerRoll: 2220, sourceRollWidth: 2.1, sourceRollLength: 2800, sourceGrammage: 40 },
  { productCode: 'PT-MQM-0002', rawMaterialCode: 'TELA-SMS-35', cutWidth: 118, cutLength: 151, unitsPerRoll: 2560, sourceRollWidth: 2.1, sourceRollLength: 3200, sourceGrammage: 35 },
  { productCode: 'PT-MQM-0002', rawMaterialCode: 'TELA-SMS-45', cutWidth: 120, cutLength: 150, unitsPerRoll: 1900, sourceRollWidth: 2.1, sourceRollLength: 2400, sourceGrammage: 45 },
  // Talla L
  { productCode: 'PT-MQL-0003', rawMaterialCode: 'TELA-SMS-40', cutWidth: 125, cutLength: 155, unitsPerRoll: 2150, sourceRollWidth: 2.1, sourceRollLength: 2800, sourceGrammage: 40 },
  { productCode: 'PT-MQL-0003', rawMaterialCode: 'TELA-SMS-35', cutWidth: 117, cutLength: 152, unitsPerRoll: 2580, sourceRollWidth: 2.1, sourceRollLength: 3200, sourceGrammage: 35 },
  { productCode: 'PT-MQL-0003', rawMaterialCode: 'TELA-SMS-45', cutWidth: 125, cutLength: 155, unitsPerRoll: 1840, sourceRollWidth: 2.1, sourceRollLength: 2400, sourceGrammage: 45 },
  // Talla XL
  { productCode: 'PT-MQX-0004', rawMaterialCode: 'TELA-SMS-40', cutWidth: 130, cutLength: 160, unitsPerRoll: 1640, sourceRollWidth: 2.1, sourceRollLength: 2800, sourceGrammage: 40 },
  { productCode: 'PT-MQX-0004', rawMaterialCode: 'TELA-SMS-35', cutWidth: 125, cutLength: 157, unitsPerRoll: 1850, sourceRollWidth: 2.1, sourceRollLength: 3200, sourceGrammage: 35 },
  { productCode: 'PT-MQX-0004', rawMaterialCode: 'TELA-SMS-45', cutWidth: 130, cutLength: 160, unitsPerRoll: 1410, sourceRollWidth: 2.1, sourceRollLength: 2400, sourceGrammage: 45 },
]

// Fecha de vigencia: la de recepción/validación de la ficha real (mtime del
// archivo fuente), no una fecha inventada.
const MATERIAL_YIELD_EFFECTIVE_FROM = new Date('2026-09-18T00:00:00.000Z')
const MATERIAL_YIELD_NOTES =
  'sourceReference = rendimiento de mandiles.xlsx. Dato técnico de planeamiento ' +
  '(rollos de tela requeridos por OP) — no reemplaza la BOM ni la ficha técnica del ' +
  'producto, que siguen siendo la única fuente de materiales requeridos.'

async function seedProductMaterialYields() {
  for (const entry of MANDIL_MATERIAL_YIELDS) {
    const product = await prisma.product.findUniqueOrThrow({ where: { code: entry.productCode } })
    const rawMaterial = await prisma.rawMaterial.findUniqueOrThrow({
      where: { code: entry.rawMaterialCode },
    })
    if (!product.size) {
      throw new Error(`El producto ${entry.productCode} no tiene talla (size) definida`)
    }

    const data = {
      cutWidth: entry.cutWidth,
      cutLength: entry.cutLength,
      unitsPerRoll: entry.unitsPerRoll,
      sourceRollWidth: entry.sourceRollWidth,
      sourceRollLength: entry.sourceRollLength,
      sourceGrammage: entry.sourceGrammage,
      notes: MATERIAL_YIELD_NOTES,
      active: true,
    }

    await prisma.productMaterialYield.upsert({
      where: {
        productId_rawMaterialId_productSize_effectiveFrom: {
          productId: product.id,
          rawMaterialId: rawMaterial.id,
          productSize: product.size,
          effectiveFrom: MATERIAL_YIELD_EFFECTIVE_FROM,
        },
      },
      update: data,
      create: {
        productId: product.id,
        rawMaterialId: rawMaterial.id,
        productSize: product.size,
        effectiveFrom: MATERIAL_YIELD_EFFECTIVE_FROM,
        ...data,
      },
    })
  }
}

async function main() {
  await seedUnits()
  await seedFamiliesAndCategories()
  await seedRawMaterials()
  await seedRoutes()
  await seedRouteSteps()
  await seedProductFamiliesAndCategories()
  await seedProducts()
  await seedBom()
  await seedCustomers()
  await seedMainDemoCase()
  await seedLaparotomiaDemoCase()
  await seedAdditionalCommercialDemo()
  await seedPlantScheduling()
  await seedF02DemoCase()
  await seedStandardTimes()
  await seedSanitaryRegistrations()
  await seedProductMaterialYields()
}

main()
  .then(async () => {
    console.log(
      'Seed completo: Maestros, BOM, Rutas, Kits, flujo Comercial/Producción y Avance/Despachos.',
    )
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
