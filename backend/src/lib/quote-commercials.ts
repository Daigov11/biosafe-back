// Subtotales comerciales de QuoteItem — siempre derivados de
// quantity × unitCostWithTax/unitCostWithoutTax/unitPriceWithTax, nunca
// persistidos. El costo/precio unitario es el único snapshot guardado en
// la cotización; el subtotal se recalcula cada vez que se lee.

export interface QuoteCommercialSource {
  quantity: unknown
  unitCostWithTax: unknown
  unitCostWithoutTax: unknown
  marginPercentage: unknown
  unitPriceWithTax: unknown
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function withQuoteItemSubtotals<T extends QuoteCommercialSource>(item: T) {
  const quantity = toNumberOrNull(item.quantity) ?? 0
  const unitCostWithTax = toNumberOrNull(item.unitCostWithTax)
  const unitCostWithoutTax = toNumberOrNull(item.unitCostWithoutTax)
  const unitPriceWithTax = toNumberOrNull(item.unitPriceWithTax)

  return {
    ...item,
    subtotalCostWithTax: unitCostWithTax !== null ? round2(unitCostWithTax * quantity) : null,
    subtotalCostWithoutTax:
      unitCostWithoutTax !== null ? round2(unitCostWithoutTax * quantity) : null,
    subtotalPriceWithTax: unitPriceWithTax !== null ? round2(unitPriceWithTax * quantity) : null,
  }
}

export function computeQuoteTotals<T extends QuoteCommercialSource>(items: T[]) {
  let totalCostWithTax = 0
  let totalCostWithoutTax = 0
  let totalPriceWithTax = 0
  let hasCost = false
  let hasPrice = false

  for (const item of items) {
    const withSubtotals = withQuoteItemSubtotals(item)
    if (withSubtotals.subtotalCostWithTax !== null) {
      totalCostWithTax += withSubtotals.subtotalCostWithTax
      hasCost = true
    }
    if (withSubtotals.subtotalCostWithoutTax !== null) {
      totalCostWithoutTax += withSubtotals.subtotalCostWithoutTax
    }
    if (withSubtotals.subtotalPriceWithTax !== null) {
      totalPriceWithTax += withSubtotals.subtotalPriceWithTax
      hasPrice = true
    }
  }

  return {
    totalCostWithTax: hasCost ? round2(totalCostWithTax) : null,
    totalCostWithoutTax: hasCost ? round2(totalCostWithoutTax) : null,
    totalPriceWithTax: hasPrice ? round2(totalPriceWithTax) : null,
  }
}
