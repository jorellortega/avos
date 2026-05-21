export type InventoryListKind = "stock" | "shopping"

/** Shown when no preset is selected (dropdown placeholder). */
export const INVENTORY_SELECT_BLANK = "—"

export const INVENTORY_SELECT_NONE = "_none" as const

/** Stock inventario sections (one card each on /inventario-edit). */
export const INVENTORY_STOCK_CATEGORIES = [
  "Tomates y vegetales",
  "Especias",
  "Proteínas",
  "Lácteos",
  "Salsas",
  "Bebidas",
  "Despensa",
  "Limpieza y suministros",
  "Otros",
] as const

export type InventoryStockCategory = (typeof INVENTORY_STOCK_CATEGORIES)[number]

export function inventoryCategoryLabel(raw: string): string {
  const t = raw.trim()
  return t || "Otros"
}

export function groupStockItemsByCategory(
  items: InventoryItemRow[],
): { category: string; items: InventoryItemRow[] }[] {
  const map = new Map<string, InventoryItemRow[]>()
  for (const item of items) {
    const cat = inventoryCategoryLabel(item.category)
    const list = map.get(cat) ?? []
    list.push(item)
    map.set(cat, list)
  }

  const result: { category: string; items: InventoryItemRow[] }[] = []
  for (const cat of INVENTORY_STOCK_CATEGORIES) {
    const list = map.get(cat)
    if (list?.length) result.push({ category: cat, items: list })
    map.delete(cat)
  }

  for (const cat of [...map.keys()].sort((a, b) => a.localeCompare(b, "es"))) {
    const list = map.get(cat)
    if (list?.length) result.push({ category: cat, items: list })
  }

  return result
}

export interface InventoryItemRow {
  id: string
  name: string
  image_url: string
  category: string
  unit: string
  quantity: number
  bolsas: number | null
  cantidad_num: number | null
  par_level: number | null
  notes: string
  list_kind: InventoryListKind
  purchased: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface InventoryAdjustmentRow {
  id: string
  item_id: string
  delta: number
  reason: string
  created_by: string | null
  created_at: string
}

export type StockStatusId =
  | "full"
  | "mitad"
  | "poco"
  | "comprar_mas"
  | "agotado"

export interface StockStatusOption {
  id: StockStatusId
  label: string
  notes: string
}

export const STOCK_STATUS_OPTIONS: StockStatusOption[] = [
  { id: "full", label: "Lleno", notes: "Lleno" },
  { id: "mitad", label: "Mitad", notes: "Mitad" },
  { id: "poco", label: "Poco", notes: "Poco" },
  { id: "comprar_mas", label: "Comprar más", notes: "Comprar más" },
  { id: "agotado", label: "Agotado", notes: "Agotado" },
]

/** Older rows may still have English preset text in notes. */
const STOCK_STATUS_NOTE_ALIASES: Partial<Record<StockStatusId, string[]>> = {
  full: ["full"],
}

export function stockStatusIsActive(
  notes: string,
  option: StockStatusOption,
): boolean {
  const n = notes.trim().toLowerCase()
  if (n === option.notes.toLowerCase()) return true
  const aliases = STOCK_STATUS_NOTE_ALIASES[option.id] ?? []
  return aliases.some((alias) => alias.toLowerCase() === n)
}

export function findStockStatusForNotes(
  notes: string,
): StockStatusOption | undefined {
  return STOCK_STATUS_OPTIONS.find((option) =>
    stockStatusIsActive(notes, option),
  )
}

export type StockQuantityPresetId =
  | "q_0_25"
  | "q_0_5"
  | "q_1"
  | "q_2"
  | "q_3"
  | "q_4"
  | "q_5"
  | "q_6"
  | "q_7"
  | "q_8"
  | "q_9"
  | "q_10"

export interface StockQuantityPreset {
  id: StockQuantityPresetId
  label: string
  quantity: number
  unit: "kg"
}

export const STOCK_QUANTITY_PRESETS: StockQuantityPreset[] = [
  { id: "q_0_25", label: "1/4", quantity: 0.25, unit: "kg" },
  { id: "q_0_5", label: "1/2", quantity: 0.5, unit: "kg" },
  { id: "q_1", label: "1", quantity: 1, unit: "kg" },
  { id: "q_2", label: "2", quantity: 2, unit: "kg" },
  { id: "q_3", label: "3", quantity: 3, unit: "kg" },
  { id: "q_4", label: "4", quantity: 4, unit: "kg" },
  { id: "q_5", label: "5", quantity: 5, unit: "kg" },
  { id: "q_6", label: "6", quantity: 6, unit: "kg" },
  { id: "q_7", label: "7", quantity: 7, unit: "kg" },
  { id: "q_8", label: "8", quantity: 8, unit: "kg" },
  { id: "q_9", label: "9", quantity: 9, unit: "kg" },
  { id: "q_10", label: "10", quantity: 10, unit: "kg" },
]

export function stockQuantityPresetIsActive(
  item: Pick<InventoryItemRow, "quantity" | "unit">,
  preset: StockQuantityPreset,
): boolean {
  return (
    Math.abs(Number(item.quantity) - preset.quantity) < 0.001 &&
    item.unit.trim().toLowerCase() === preset.unit.toLowerCase()
  )
}

export function findStockQuantityPresetForItem(
  item: Pick<InventoryItemRow, "quantity" | "unit">,
): StockQuantityPreset | undefined {
  return STOCK_QUANTITY_PRESETS.find((preset) =>
    stockQuantityPresetIsActive(item, preset),
  )
}

export function stockQuantityLabelForItem(
  item: Pick<InventoryItemRow, "quantity" | "unit">,
): string | null {
  const preset = findStockQuantityPresetForItem(item)
  if (preset) return preset.label
  const q = Number(item.quantity)
  if (q > 0 && item.unit.trim().toLowerCase() === "kg") {
    if (q === 0.25) return "1/4"
    if (q === 0.5) return "1/2"
    return Number.isInteger(q) ? String(q) : `${q}`
  }
  return null
}

export type StockBolsasPresetId =
  | "b_1"
  | "b_2"
  | "b_3"
  | "b_4"
  | "b_5"
  | "b_6"
  | "b_7"
  | "b_8"
  | "b_9"
  | "b_10"

export interface StockBolsasPreset {
  id: StockBolsasPresetId
  label: string
  bolsas: number
}

export const STOCK_BOLSAS_PRESETS: StockBolsasPreset[] = Array.from(
  { length: 10 },
  (_, i) => {
    const n = i + 1
    return {
      id: `b_${n}` as StockBolsasPresetId,
      label: String(n),
      bolsas: n,
    }
  },
)

export function stockBolsasPresetIsActive(
  item: Pick<InventoryItemRow, "bolsas">,
  preset: StockBolsasPreset,
): boolean {
  return item.bolsas != null && Number(item.bolsas) === preset.bolsas
}

export function findStockBolsasPresetForItem(
  item: Pick<InventoryItemRow, "bolsas">,
): StockBolsasPreset | undefined {
  return STOCK_BOLSAS_PRESETS.find((preset) =>
    stockBolsasPresetIsActive(item, preset),
  )
}

export function stockBolsasLabelForItem(
  item: Pick<InventoryItemRow, "bolsas">,
): string | null {
  const preset = findStockBolsasPresetForItem(item)
  if (preset) return preset.label
  const n = item.bolsas
  if (n != null && n >= 1 && n <= 10 && Number.isInteger(Number(n))) {
    return String(n)
  }
  return null
}

export type StockCountPresetId = `n_${number}`

export interface StockCountPreset {
  id: StockCountPresetId
  label: string
  cantidad_num: number
}

export const STOCK_COUNT_PRESETS: StockCountPreset[] = Array.from(
  { length: 50 },
  (_, i) => {
    const n = i + 1
    return {
      id: `n_${n}` as StockCountPresetId,
      label: String(n),
      cantidad_num: n,
    }
  },
)

export function stockCountPresetIsActive(
  item: Pick<InventoryItemRow, "cantidad_num">,
  preset: StockCountPreset,
): boolean {
  return (
    item.cantidad_num != null &&
    Number(item.cantidad_num) === preset.cantidad_num
  )
}

export function findStockCountPresetForItem(
  item: Pick<InventoryItemRow, "cantidad_num">,
): StockCountPreset | undefined {
  return STOCK_COUNT_PRESETS.find((preset) =>
    stockCountPresetIsActive(item, preset),
  )
}

/** @deprecated Use StockStatusOption */
export type StockQuickAction = StockStatusOption
/** @deprecated Use STOCK_STATUS_OPTIONS */
export const STOCK_QUICK_ACTIONS = STOCK_STATUS_OPTIONS
/** @deprecated Use stockStatusIsActive */
export const stockQuickActionIsActive = stockStatusIsActive
