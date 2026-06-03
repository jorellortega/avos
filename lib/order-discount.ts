import type { OrderItem } from "@/components/orders-provider"

/** Staff discount presets (portal / register). */
export type OrderDiscountPreset = "employee_20" | "employee_meal"

export type OrderDiscountState = {
  preset?: OrderDiscountPreset
  /** Manual % off (0–100); ignored when preset is set. */
  percent?: number
}

/** Bottled / canned drinks still charged on employee meal (not aguas frescas). */
export const BEBIDA_BOTELLA_IDS = new Set<string>(["michelada"])

const AGUAS_FRESCAS_IDS = new Set([
  "jamaica",
  "pina",
  "limon-pepino",
  "mango",
  "alfalfa",
  "naranja",
  "horchata",
  "melon",
  "sandia",
])

export function parseOrderDiscountPercentInput(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, ".")
  if (!cleaned) return 0
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(100, Math.round(n * 100) / 100)
}

export function orderItemLineTotal(item: OrderItem): number {
  return item.precio * item.cantidad
}

export function bebidaIdFromOrderLine(item: OrderItem): string | null {
  if (item.bebidaId?.trim()) return item.bebidaId.trim()
  const cat = item.categoria?.toLowerCase() ?? ""
  if (cat !== "bebidas" && cat !== "bebida") return null
  const id = item.id
  for (const tam of ["chico", "grande"] as const) {
    const suffix = `-${tam}`
    if (id.endsWith(suffix)) {
      const base = id.slice(0, -suffix.length)
      if (base && !base.startsWith("elige")) return base
    }
  }
  return null
}

export function isAguaFrescaBebidaId(bebidaId: string): boolean {
  return AGUAS_FRESCAS_IDS.has(bebidaId)
}

/** Charge bottled drinks on employee meal; aguas frescas and food are free. */
export function isChargeableBottleOrderItem(item: OrderItem): boolean {
  const bebidaId = bebidaIdFromOrderLine(item)
  if (bebidaId) {
    if (isAguaFrescaBebidaId(bebidaId)) return false
    if (BEBIDA_BOTELLA_IDS.has(bebidaId)) return true
    return !isAguaFrescaBebidaId(bebidaId)
  }
  const cat = item.categoria?.toLowerCase() ?? ""
  if (cat !== "bebidas" && cat !== "bebida") return false
  if (/michelada/i.test(item.nombre)) return true
  if (/agua de|horchata|aguas frescas/i.test(item.nombre)) return false
  return false
}

export function employeeMealChargeableSubtotal(items: OrderItem[]): number {
  return items
    .filter(isChargeableBottleOrderItem)
    .reduce((sum, item) => sum + orderItemLineTotal(item), 0)
}

export function effectiveDiscountPercent(state: OrderDiscountState | undefined): number {
  if (!state) return 0
  if (state.preset === "employee_20") return 20
  if (state.preset === "employee_meal") return 0
  return Math.max(0, Math.min(100, state.percent ?? 0))
}

export function computeOrderDiscountAmount(
  items: OrderItem[],
  state: OrderDiscountState | undefined,
): number {
  if (!state?.preset && !(state?.percent && state.percent > 0)) return 0
  const subtotal = items.reduce((s, item) => s + orderItemLineTotal(item), 0)
  if (subtotal <= 0) return 0

  if (state.preset === "employee_meal") {
    const chargeable = employeeMealChargeableSubtotal(items)
    const discount = Math.round((subtotal - chargeable) * 100) / 100
    return Math.max(0, Math.min(subtotal, discount))
  }

  const pct = effectiveDiscountPercent(state)
  if (pct <= 0) return 0
  return Math.round(subtotal * (pct / 100) * 100) / 100
}

export const ORDER_DISCOUNT_PRESET_LABELS: Record<OrderDiscountPreset, string> = {
  employee_20: "20%",
  employee_meal: "Comida emp.",
}
