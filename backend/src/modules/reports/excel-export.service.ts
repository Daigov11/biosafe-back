import ExcelJS from 'exceljs'
import type { OrderStatusRow } from './order-status.service.js'
import { groupPlantViewByDate, type getPlantView } from '../planning/planning.service.js'
import { complianceStateLabel } from '../planning/plant-compliance.js'

function round(value: number) {
  return Math.round(value * 100) / 100
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A8A' },
}
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true }
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.border = THIN_BORDER
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  row.height = 28
}

function applyDataBorders(sheet: ExcelJS.Worksheet, fromRow: number) {
  for (let r = fromRow; r <= sheet.rowCount; r++) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER
    })
  }
}

type PlantViewRow = Awaited<ReturnType<typeof getPlantView>>[number]

const COMPLIANCE_FONT_COLOR: Record<string, string> = {
  Pendiente: 'FFB45309', // ámbar
  Cumplido: 'FF15803D', // verde
  Sobreproducción: 'FF1D4ED8', // azul
  'Sin programación': 'FF6B7280', // gris neutro
}

const SUBTOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
const TOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } }

export async function buildPlantProgrammingWorkbook(rows: PlantViewRow[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'BIOSAFE ERP'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Programación de Planta', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const columns: { header: string; key: string; width: number }[] = [
    { header: 'Prioridad', key: 'priority', width: 10 },
    { header: 'Cliente', key: 'cliente', width: 22 },
    { header: 'Lote', key: 'lote', width: 18 },
    { header: 'Producto', key: 'producto', width: 32 },
    { header: 'Línea', key: 'line', width: 16 },
    { header: 'FECHA PROGRAMADA', key: 'scheduledDate', width: 18 },
    { header: 'PROGRAMADO', key: 'programado', width: 13 },
    { header: 'REAL', key: 'real', width: 13 },
    { header: 'DIFERENCIA', key: 'diferencia', width: 13 },
    { header: '% P/R', key: 'pctPR', width: 10 },
    { header: 'ESTADO', key: 'estado', width: 16 },
    { header: 'Comentarios', key: 'comentarios', width: 24 },
    { header: 'Fecha fin ofrecida', key: 'offeredEndDate', width: 16 },
    { header: 'Programación', key: 'schedulingNotes', width: 24 },
    { header: 'Capacidad', key: 'capacidad', width: 20 },
    { header: 'Días giro', key: 'daysToTurn', width: 10 },
    { header: 'Inicio', key: 'startDate', width: 14 },
  ]
  sheet.columns = columns
  styleHeaderRow(sheet.getRow(1))
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }

  // Vista diaria (Iteración — mejora obligatoria): agrupada por FECHA
  // PROGRAMADA (nunca inventada — ver `groupPlantViewByDate`), con un
  // total diario al final de cada grupo cuando hay más de un lote ese
  // día. Los grupos "sin fecha" se listan sin total de cumplimiento.
  const groups = groupPlantViewByDate(rows)

  function writeRow(row: PlantViewRow) {
    const state = complianceStateLabel(row.diferencia)
    const excelRow = sheet.addRow({
      priority: row.priority,
      cliente: row.lot.customer.name,
      lote: row.lot.lotCode,
      producto: `${row.lot.product.code} · ${row.lot.product.name}`,
      line: row.line ?? '—',
      scheduledDate: row.scheduledDate ?? 'Sin fecha programada',
      programado: row.programado,
      real: row.real ?? '—',
      diferencia: row.diferencia ?? '—',
      pctPR: row.pctPR !== null ? row.pctPR / 100 : '—',
      estado: state,
      comentarios: row.comments ?? '',
      offeredEndDate: row.offeredEndDate,
      schedulingNotes: row.schedulingNotes ?? '',
      // `row.capacity.unit` ya incluye la cadencia (p.ej. "kits/día",
      // "unidades/día" en el maestro de Capacidades) — no se le agrega
      // "/día" de nuevo aquí (bug detectado en QA: producía "kits/día/día").
      // Coincide con cómo ya se mostraba correctamente en pantalla
      // (Programación de Planta).
      capacidad: row.capacity ? `${row.capacity.name} (${row.capacity.dailyCapacity} ${row.capacity.unit})` : '—',
      daysToTurn: row.daysToTurn ?? '—',
      startDate: row.startDate,
    })
    if (row.scheduledDate) excelRow.getCell('scheduledDate').numFmt = 'dd/mm/yyyy'
    excelRow.getCell('offeredEndDate').numFmt = 'dd/mm/yyyy'
    excelRow.getCell('startDate').numFmt = 'dd/mm/yyyy'
    if (row.pctPR !== null) excelRow.getCell('pctPR').numFmt = '0.0%'
    excelRow.getCell('diferencia').alignment = { horizontal: 'right' }
    excelRow.getCell('programado').alignment = { horizontal: 'right' }
    excelRow.getCell('real').alignment = { horizontal: 'right' }
    excelRow.getCell('estado').font = { color: { argb: COMPLIANCE_FONT_COLOR[state] }, bold: true }
  }

  function writeTotalsRow(label: string, totals: ReturnType<typeof groupPlantViewByDate>[number]['totals'], fill: ExcelJS.Fill) {
    const state = complianceStateLabel(totals.diferencia)
    const excelRow = sheet.addRow({
      priority: '',
      cliente: '',
      lote: '',
      producto: label,
      line: '',
      scheduledDate: '',
      programado: totals.programado,
      real: totals.real ?? '—',
      diferencia: totals.diferencia ?? '—',
      pctPR: totals.pctPR !== null ? totals.pctPR / 100 : '—',
      estado: state,
      comentarios: '',
      offeredEndDate: null,
      schedulingNotes: '',
      capacidad: '',
      daysToTurn: '',
      startDate: null,
    })
    if (totals.pctPR !== null) excelRow.getCell('pctPR').numFmt = '0.0%'
    excelRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill
      cell.font = { ...cell.font, bold: true }
    })
    excelRow.getCell('estado').font = { color: { argb: COMPLIANCE_FONT_COLOR[state] }, bold: true }
    excelRow.getCell('diferencia').alignment = { horizontal: 'right' }
    excelRow.getCell('programado').alignment = { horizontal: 'right' }
    excelRow.getCell('real').alignment = { horizontal: 'right' }
  }

  for (const group of groups) {
    for (const row of group.rows) writeRow(row)
    if (group.scheduledDate && group.rows.length > 1) {
      const dateLabel = group.scheduledDate.toLocaleDateString('es-PE', { timeZone: 'America/Lima' })
      writeTotalsRow(`Total del día ${dateLabel}`, group.totals, SUBTOTAL_FILL)
    }
  }

  if (rows.length > 1) {
    const grandProgramado = round(rows.reduce((sum, row) => sum + row.programado, 0))
    const hasReal = rows.some((row) => row.real !== null)
    const grandReal = hasReal ? round(rows.reduce((sum, row) => sum + (row.real ?? 0), 0)) : null
    const grandDiferencia = grandReal !== null ? round(grandProgramado - grandReal) : null
    const grandPct = grandReal !== null && grandProgramado > 0 ? Math.round((grandReal / grandProgramado) * 1000) / 10 : null
    writeTotalsRow('TOTAL GENERAL', { scheduledDate: null, programado: grandProgramado, real: grandReal, diferencia: grandDiferencia, pctPR: grandPct }, TOTAL_FILL)
  }

  applyDataBorders(sheet, 2)

  return workbook
}

const ORDER_STATUS_COLUMNS: { header: string; key: keyof OrderStatusRow; width: number; type?: 'date' | 'percent' }[] = [
  { header: 'F.CREAC', key: 'fCreac', width: 12, type: 'date' },
  { header: 'F.REQ', key: 'fReq', width: 12, type: 'date' },
  { header: 'F.REAL', key: 'fReal', width: 12, type: 'date' },
  { header: 'FECHA DE CADUCIDAD', key: 'fechaCaducidad', width: 14, type: 'date' },
  { header: 'CLIENTE', key: 'cliente', width: 22 },
  { header: 'PEDIDO', key: 'pedido', width: 12 },
  { header: 'ORDEN DE COMPRA', key: 'ordenCompra', width: 14 },
  { header: 'LOTE', key: 'lote', width: 16 },
  { header: 'LOTE DE REFERENCIA', key: 'loteReferencia', width: 16 },
  { header: 'CÓDIGO DE KIT', key: 'codigoKit', width: 14 },
  { header: 'NOMBRE DE KIT', key: 'nombreKit', width: 26 },
  { header: 'DESCRIPCIÓN DEL PRODUCTO', key: 'descripcionProducto', width: 32 },
  { header: 'M', key: 'm', width: 8 },
  { header: 'L', key: 'l', width: 8 },
  { header: 'XL', key: 'xl', width: 8 },
  { header: 'CÓDIGO DE LA PIEZA', key: 'codigoPieza', width: 16 },
  { header: 'NOMBRE DE LA PIEZA', key: 'nombrePieza', width: 26 },
  { header: 'CÓDIGO DE LA TELA', key: 'codigoTela', width: 14 },
  { header: 'TELA', key: 'tela', width: 20 },
  { header: 'METROS DE TELA REQ.', key: 'telaMetrosRequeridos', width: 14 },
  { header: 'KILOS DE TELA REQ.', key: 'telaKilosRequeridos', width: 14 },
  { header: 'CANTIDAD DE KIT', key: 'cantidadKit', width: 12 },
  { header: 'UNIDADES X KIT', key: 'unidadesXKit', width: 12 },
  { header: 'TOTAL REQ.', key: 'totalReq', width: 12 },
  { header: 'REFUERZO', key: 'refuerzo', width: 10 },
  { header: 'FENESTRA', key: 'fenestra', width: 10 },
  { header: 'LAMINADO', key: 'laminado', width: 10 },
  { header: 'ADHESIVO', key: 'adhesivo', width: 10 },
  { header: 'ETIQUETA', key: 'etiqueta', width: 10 },
  { header: 'BOLSA DE EMPAQUE', key: 'bolsaDeEmpaque', width: 14 },
  { header: 'APROBACIÓN DE ETIQUETA', key: 'aprobacionEtiqueta', width: 16 },
  { header: 'RUTA', key: 'ruta', width: 20 },
  { header: 'ANCHO', key: 'ancho', width: 10 },
  { header: 'LARGO', key: 'largo', width: 10 },
  { header: 'GRAMAJE', key: 'gramaje', width: 10 },
  { header: 'TIEMPO ESTÁNDAR', key: 'tiempoEstandar', width: 14 },
  { header: 'TENDIDO Y CORTE', key: 'corte', width: 12 },
  { header: '% CORTE', key: 'pctCorte', width: 10, type: 'percent' },
  { header: 'COSTURA', key: 'costura', width: 12 },
  { header: '% COSTURA', key: 'pctCostura', width: 10, type: 'percent' },
  { header: 'EMPAQUE', key: 'empaque', width: 12 },
  { header: '% EMPAQUE', key: 'pctEmpaque', width: 10, type: 'percent' },
  { header: 'ESTERILIZADO', key: 'esterilizado', width: 12 },
  { header: '% ESTERILIZADO', key: 'pctEsterilizado', width: 10, type: 'percent' },
  { header: 'CONTROL DE CALIDAD', key: 'controlCalidad', width: 14 },
  { header: '% CONTROL DE CALIDAD', key: 'pctControlCalidad', width: 10, type: 'percent' },
  { header: 'PT', key: 'pt', width: 10 },
  { header: '% PT', key: 'pctPt', width: 10, type: 'percent' },
  { header: 'DESPACHADO', key: 'despachado', width: 12 },
  { header: '% DESPACHADO', key: 'pctDespachado', width: 10, type: 'percent' },
  { header: 'SALDO', key: 'saldo', width: 12 },
  { header: '% SALDO', key: 'pctSaldo', width: 10, type: 'percent' },
]

const BOOLEAN_KEYS = new Set<keyof OrderStatusRow>([
  'refuerzo',
  'fenestra',
  'laminado',
  'adhesivo',
  'etiqueta',
  'bolsaDeEmpaque',
])

export async function buildOrderStatusWorkbook(rows: OrderStatusRow[], filtersLabel?: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'BIOSAFE ERP'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Situación de Pedidos', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: filtersLabel ? 2 : 1, xSplit: 4 }],
  })

  const headerRowIndex = filtersLabel ? 2 : 1

  sheet.columns = ORDER_STATUS_COLUMNS.map((col) => ({ key: col.key, width: col.width }))

  if (filtersLabel) {
    sheet.mergeCells(1, 1, 1, ORDER_STATUS_COLUMNS.length)
    const filtersCell = sheet.getCell(1, 1)
    filtersCell.value = `Filtros aplicados: ${filtersLabel}`
    filtersCell.font = { italic: true, bold: true }
    filtersCell.alignment = { vertical: 'middle', horizontal: 'left' }
    sheet.getRow(1).height = 20
  }

  sheet.getRow(headerRowIndex).values = ORDER_STATUS_COLUMNS.map((col) => col.header)
  styleHeaderRow(sheet.getRow(headerRowIndex))

  for (const row of rows) {
    const record: Record<string, unknown> = {}
    for (const col of ORDER_STATUS_COLUMNS) {
      const value = row[col.key]
      record[col.key] = BOOLEAN_KEYS.has(col.key) ? (value ? 'Sí' : 'No') : value
    }
    const excelRow = sheet.addRow(record)

    for (const col of ORDER_STATUS_COLUMNS) {
      if (col.type === 'date') {
        excelRow.getCell(col.key).numFmt = 'dd/mm/yyyy'
      } else if (col.type === 'percent') {
        const cell = excelRow.getCell(col.key)
        const raw = row[col.key]
        cell.value = typeof raw === 'number' ? raw / 100 : null
        cell.numFmt = '0%'
      }
    }
  }

  applyDataBorders(sheet, headerRowIndex + 1)

  return workbook
}
