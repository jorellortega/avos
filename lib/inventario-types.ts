export type InventoryListKind = "stock" | "shopping"

/** Shown when no preset is selected (dropdown placeholder). */
export const INVENTORY_SELECT_BLANK = "—"

export const INVENTORY_SELECT_NONE = "_none" as const

/** Default stock sections (seeded into DB; fallback if table empty). */
export const DEFAULT_INVENTORY_STOCK_CATEGORIES = [
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

/** @deprecated Use categories from DB; kept for compatibility. */
export const INVENTORY_STOCK_CATEGORIES = DEFAULT_INVENTORY_STOCK_CATEGORIES

export type InventoryStockCategory =
  (typeof DEFAULT_INVENTORY_STOCK_CATEGORIES)[number]

export interface InventoryStockCategoryRow {
  id: string
  name: string
  sort_order: number
  show_marinated: boolean
  created_at: string
  updated_at: string
}

export function normalizeStockCategory(
  row: InventoryStockCategoryRow,
): InventoryStockCategoryRow {
  return {
    ...row,
    name: (row.name ?? "").trim(),
    sort_order: Number(row.sort_order) || 0,
    show_marinated: Boolean(row.show_marinated),
  }
}

export function stockCategoryNames(
  categories: InventoryStockCategoryRow[],
): string[] {
  return [...categories]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es"))
    .map((c) => (c.name ?? "").trim())
    .filter((name) => name.length > 0)
}

export function categoryShowsMarinated(
  categoryName: string | null | undefined,
  categories: InventoryStockCategoryRow[],
): boolean {
  const name = inventoryCategoryLabel(categoryName)
  return categories.some((c) => c.name === name && c.show_marinated)
}

export function inventoryCategoryLabel(
  raw: string | null | undefined,
): string {
  const t = (raw ?? "").trim()
  return t || "Otros"
}

export function groupStockItemsByCategory(
  items: InventoryItemRow[],
  categoryOrder: string[] = [...DEFAULT_INVENTORY_STOCK_CATEGORIES],
): { category: string; items: InventoryItemRow[] }[] {
  const map = new Map<string, InventoryItemRow[]>()
  for (const item of items) {
    const cat = inventoryCategoryLabel(item.category)
    const list = map.get(cat) ?? []
    list.push(item)
    map.set(cat, list)
  }

  const result: { category: string; items: InventoryItemRow[] }[] = []
  const seen = new Set<string>()
  for (const cat of categoryOrder) {
    const label = inventoryCategoryLabel(cat)
    if (seen.has(label)) continue
    seen.add(label)
    const list = map.get(label)
    if (list?.length) result.push({ category: label, items: list })
    map.delete(label)
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
  category: string | null
  unit: string
  quantity: number
  bolsas: number | null
  cantidad_num: number | null
  marinated: boolean | null
  stock_action: string
  par_level: number | null
  /** Target applies per day or per week (stock only). */
  par_period: InventoryParPeriod | null
  /** Unit for par_level: kg, pza, or bolsas. */
  par_unit: InventoryParUnit | null
  /** Typical low unit price (MXN). */
  price_min: number | null
  /** Typical high unit price (MXN); same as min if fixed. */
  price_max: number | null
  /** Free-text note copied to lista de compras (stock rows). */
  buy_note: string
  notes: string
  list_kind: InventoryListKind
  purchased: boolean
  /** Hidden from /lista-compras runner link; CEO/manager still see it. */
  runner_hidden: boolean
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
  notes: string | null | undefined,
  option: StockStatusOption,
): boolean {
  const n = (notes ?? "").trim().toLowerCase()
  if (n === option.notes.toLowerCase()) return true
  const aliases = STOCK_STATUS_NOTE_ALIASES[option.id] ?? []
  return aliases.some((alias) => alias.toLowerCase() === n)
}

export function findStockStatusForNotes(
  notes: string | null | undefined,
): StockStatusOption | undefined {
  return STOCK_STATUS_OPTIONS.find((option) =>
    stockStatusIsActive(notes, option),
  )
}

/** Agotado means nothing on hand — clear kilos, count, and bolsas. */
export function stockStatusClearsOnHand(statusId: StockStatusId): boolean {
  return statusId === "agotado"
}

export function stockQuantitiesClearedPatch(): Pick<
  InventoryItemRow,
  "quantity" | "unit" | "cantidad_num" | "bolsas"
> {
  return {
    quantity: 0,
    unit: "kg",
    cantidad_num: null,
    bolsas: null,
  }
}

export function patchForStockStatusOption(
  option: StockStatusOption,
): Partial<InventoryItemRow> {
  const patch: Partial<InventoryItemRow> = { notes: option.notes }
  if (stockStatusClearsOnHand(option.id)) {
    Object.assign(patch, stockQuantitiesClearedPatch())
  }
  return patch
}

export function parseInventoryPriceInput(
  raw: string | null | undefined,
): number | null {
  const t = (raw ?? "").trim().replace(/[$,\s]/g, "")
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export function normalizeInventoryPrice(
  value: number | null | undefined,
): number | null {
  if (value == null || value === undefined) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export function formatInventoryPriceRange(
  item: Pick<InventoryItemRow, "price_min" | "price_max">,
): string | null {
  const min = normalizeInventoryPrice(item.price_min)
  const max = normalizeInventoryPrice(item.price_max)
  if (min == null && max == null) return null
  const fmt = (n: number) =>
    n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`
  if (min != null && max != null && max !== min) {
    return `${fmt(min)} – ${fmt(max)}`
  }
  const single = min ?? max
  return single != null ? fmt(single) : null
}

export function mergeInventoryPricesFromSource(
  target: InventoryItemRow | undefined,
  source: Pick<InventoryItemRow, "price_min" | "price_max">,
): Partial<Pick<InventoryItemRow, "price_min" | "price_max">> {
  const hasSource =
    normalizeInventoryPrice(source.price_min) != null ||
    normalizeInventoryPrice(source.price_max) != null
  if (!hasSource) return {}
  const targetEmpty =
    !target ||
    (normalizeInventoryPrice(target.price_min) == null &&
      normalizeInventoryPrice(target.price_max) == null)
  if (!targetEmpty) return {}
  return inventoryPricesPatch(source)
}

export function inventoryPricesPatch(
  source: Pick<InventoryItemRow, "price_min" | "price_max">,
): Pick<InventoryItemRow, "price_min" | "price_max"> {
  let min = normalizeInventoryPrice(source.price_min)
  let max = normalizeInventoryPrice(source.price_max)
  if (min != null && max != null && max < min) {
    const swap = min
    min = max
    max = swap
  }
  return { price_min: min, price_max: max }
}

/** Buy / reorder actions (separate from on-hand Estado). */
export type StockActionId =
  | "buy_now"
  | "have_reserves"
  | "order_soon"
  | "in_transit"
  | "check_supplier"

export interface StockActionOption {
  id: StockActionId
  label: string
  value: string
}

export const STOCK_ACTION_OPTIONS: StockActionOption[] = [
  { id: "buy_now", label: "Comprar ahora", value: "Comprar ahora" },
  { id: "have_reserves", label: "Tener reservas", value: "Tener reservas" },
  { id: "order_soon", label: "Pedir pronto", value: "Pedir pronto" },
  { id: "in_transit", label: "En camino", value: "En camino" },
  { id: "check_supplier", label: "Revisar proveedor", value: "Revisar proveedor" },
]

const STOCK_ACTION_ALIASES: Partial<Record<StockActionId, string[]>> = {
  buy_now: ["buy now", "comprar ya"],
  have_reserves: ["have reserves", "con reservas", "reserves"],
  order_soon: ["order soon", "pedir"],
  in_transit: ["in transit", "en transito"],
  check_supplier: ["check supplier", "revisar"],
}

export function stockActionIsActive(
  stockAction: string,
  option: StockActionOption,
): boolean {
  const n = stockAction.trim().toLowerCase()
  if (n === option.value.toLowerCase()) return true
  const aliases = STOCK_ACTION_ALIASES[option.id] ?? []
  return aliases.some((alias) => alias.toLowerCase() === n)
}

export function findStockActionForValue(
  stockAction: string | null | undefined,
): StockActionOption | undefined {
  const raw = (stockAction ?? "").trim()
  if (!raw) return undefined
  return STOCK_ACTION_OPTIONS.find((option) =>
    stockActionIsActive(raw, option),
  )
}

export function stockActionLabelForItem(
  item: Pick<InventoryItemRow, "stock_action">,
): string | null {
  return findStockActionForValue(item.stock_action)?.label ?? null
}

/** Stock Estado values that should appear on the shopping list. */
export const STOCK_STATUS_NEEDS_BUY: StockStatusId[] = [
  "poco",
  "comprar_mas",
  "agotado",
]

/** Stock Acción values that should appear on the shopping list. */
export const STOCK_ACTION_NEEDS_BUY: StockActionId[] = [
  "buy_now",
  "order_soon",
  "check_supplier",
]

export function stockHasParTarget(
  item: Pick<InventoryItemRow, "par_level" | "par_period" | "par_unit">,
): boolean {
  return (
    item.par_level != null &&
    item.par_level > 0 &&
    normalizeInventoryParPeriod(item.par_period) != null &&
    normalizeInventoryParUnit(item.par_unit) != null
  )
}

export function stockItemNeedsPurchase(
  item: Pick<
    InventoryItemRow,
    | "list_kind"
    | "notes"
    | "stock_action"
    | "par_level"
    | "par_period"
    | "par_unit"
    | "quantity"
    | "unit"
    | "cantidad_num"
    | "bolsas"
  >,
): boolean {
  if (item.list_kind !== "stock") return false

  const status = findStockStatusForNotes(item.notes)
  if (status?.id === "agotado") return true

  if (stockHasParTarget(item)) {
    return stockParGap(item) != null
  }

  if (status && STOCK_STATUS_NEEDS_BUY.includes(status.id)) return true
  const action = findStockActionForValue(item.stock_action)
  if (action && STOCK_ACTION_NEEDS_BUY.includes(action.id)) return true
  return false
}

/** Notes line for a shopping-list row copied from stock. */
export function shoppingNotesFromStock(
  item: Pick<
    InventoryItemRow,
    | "notes"
    | "stock_action"
    | "quantity"
    | "unit"
    | "cantidad_num"
    | "bolsas"
  >,
): string {
  const parts: string[] = []
  const status = findStockStatusForNotes(item.notes)
  if (status) parts.push(`Estado: ${status.label}`)
  const actionLabel = stockActionLabelForItem(item)
  if (actionLabel) parts.push(`Acción: ${actionLabel}`)
  const kilos = stockQuantityLabelForItem(item)
  if (kilos) parts.push(`En cocina: ${kilos}`)
  if (item.cantidad_num != null && item.cantidad_num > 0) {
    parts.push(`Cantidad: ${item.cantidad_num}`)
  }
  if (item.bolsas != null && item.bolsas > 0) {
    parts.push(`Bolsas: ${item.bolsas}`)
  }
  return parts.length ? parts.join(" · ") : "Reabastecer"
}

/** Notes shown on lista de compras — buy_note wins over auto-generated status lines. */
export function resolveShoppingListNotes(
  stock: Pick<
    InventoryItemRow,
    | "buy_note"
    | "notes"
    | "stock_action"
    | "quantity"
    | "unit"
    | "cantidad_num"
    | "bolsas"
  >,
): string {
  const buyNote = (stock.buy_note ?? "").trim()
  if (buyNote) return buyNote.slice(0, 500)
  return shoppingNotesFromStock(stock)
}

export type InventoryParPeriod = "day" | "week"
export type InventoryParUnit = "kg" | "pza" | "bolsas"

export const INVENTORY_PAR_PERIOD_OPTIONS: {
  id: InventoryParPeriod
  label: string
}[] = [
  { id: "day", label: "Día" },
  { id: "week", label: "Semana" },
]

export const INVENTORY_PAR_UNIT_OPTIONS: {
  id: InventoryParUnit
  label: string
}[] = [
  { id: "kg", label: "Kilos" },
  { id: "pza", label: "Piezas" },
  { id: "bolsas", label: "Bolsas" },
]

export function normalizeInventoryParPeriod(
  raw: string | null | undefined,
): InventoryParPeriod | null {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "day" || v === "week") return v
  return null
}

export function normalizeInventoryParUnit(
  raw: string | null | undefined,
): InventoryParUnit | null {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "kg" || v === "pza" || v === "bolsas") return v
  return null
}

export function stockOnHandForParUnit(
  item: Pick<
    InventoryItemRow,
    "quantity" | "unit" | "cantidad_num" | "bolsas"
  >,
  parUnit: InventoryParUnit,
): number {
  if (parUnit === "kg") return Number(item.quantity) || 0
  if (parUnit === "pza") return item.cantidad_num ?? 0
  return item.bolsas ?? 0
}

export function stockParTargetLabel(
  item: Pick<
    InventoryItemRow,
    "par_level" | "par_period" | "par_unit"
  >,
): string | null {
  if (item.par_level == null || item.par_level <= 0) return null
  if (!item.par_period || !item.par_unit) return null
  const unit =
    INVENTORY_PAR_UNIT_OPTIONS.find((u) => u.id === item.par_unit)?.label ??
    item.par_unit
  const period =
    INVENTORY_PAR_PERIOD_OPTIONS.find((p) => p.id === item.par_period)?.label ??
    item.par_period
  const qty =
    item.par_unit === "kg" && Number.isInteger(item.par_level)
      ? String(item.par_level)
      : String(item.par_level)
  return `${qty} ${unit.toLowerCase()} / ${period.toLowerCase()}`
}

export type StockParGap = {
  gap: number
  unitLabel: string
  periodLabel: string
}

export function stockParGap(
  item: Pick<
    InventoryItemRow,
    | "par_level"
    | "par_period"
    | "par_unit"
    | "quantity"
    | "unit"
    | "cantidad_num"
    | "bolsas"
  >,
): StockParGap | null {
  if (item.par_level == null || item.par_level <= 0) return null
  if (!item.par_period || !item.par_unit) return null
  const onHand = stockOnHandForParUnit(item, item.par_unit)
  const gap = item.par_level - onHand
  if (gap <= 0) return null
  const unitLabel =
    INVENTORY_PAR_UNIT_OPTIONS.find((u) => u.id === item.par_unit)?.label ??
    item.par_unit
  const periodLabel =
    INVENTORY_PAR_PERIOD_OPTIONS.find((p) => p.id === item.par_period)?.label ??
    item.par_period
  return {
    gap: item.par_unit === "kg" ? gap : Math.ceil(gap),
    unitLabel,
    periodLabel,
  }
}

export function suggestedBuyFromParLevel(
  stock: Pick<
    InventoryItemRow,
    | "par_level"
    | "par_period"
    | "par_unit"
    | "quantity"
    | "unit"
    | "cantidad_num"
    | "bolsas"
  >,
): Partial<
  Pick<InventoryItemRow, "quantity" | "unit" | "cantidad_num" | "bolsas">
> {
  const gapInfo = stockParGap(stock)
  if (!gapInfo || !stock.par_unit) return {}
  const out: Partial<
    Pick<InventoryItemRow, "quantity" | "unit" | "cantidad_num" | "bolsas">
  > = {}
  if (stock.par_unit === "kg") {
    out.quantity = gapInfo.gap
    out.unit = "kg"
  } else if (stock.par_unit === "pza") {
    out.cantidad_num = gapInfo.gap
  } else {
    out.bolsas = gapInfo.gap
  }
  return out
}

/** Read-only context from linked stock (estado, acción, en cocina). */
export function stockLinkedContextLabel(
  item: Pick<
    InventoryItemRow,
    | "notes"
    | "stock_action"
    | "quantity"
    | "unit"
    | "cantidad_num"
    | "bolsas"
    | "par_level"
    | "par_period"
    | "par_unit"
    | "price_min"
    | "price_max"
  >,
): string | null {
  const parts: string[] = []
  const status = findStockStatusForNotes(item.notes)
  if (status) parts.push(`Estado: ${status.label}`)
  const actionLabel = stockActionLabelForItem(item)
  if (actionLabel) parts.push(`Acción: ${actionLabel}`)
  const kilos = stockQuantityLabelForItem(item)
  if (kilos) parts.push(`En cocina: ${kilos} kg`)
  if (item.cantidad_num != null && item.cantidad_num > 0) {
    parts.push(`Cuenta: ${item.cantidad_num}`)
  }
  if (item.bolsas != null && item.bolsas > 0) {
    parts.push(`Bolsas: ${item.bolsas}`)
  }
  const par = stockParTargetLabel(item)
  if (par) parts.push(`Meta: ${par}`)
  const price = formatInventoryPriceRange(item)
  if (price) parts.push(`Precio: ${price}`)
  return parts.length ? parts.join(" · ") : null
}

/** Legacy rows synced before structured buy quantities existed. */
export function isAutoSyncedShoppingNotes(notes: string | null | undefined): boolean {
  const n = (notes ?? "").trim()
  if (!n) return false
  if (n === "Reabastecer") return true
  return n.startsWith("Estado:") || /^Estado:.*En cocina:/.test(n)
}

/** Suggested buy amounts when stock needs restock. */
export function suggestedBuyFromStock(
  stock: Pick<
    InventoryItemRow,
    | "notes"
    | "stock_action"
    | "quantity"
    | "unit"
    | "cantidad_num"
    | "bolsas"
    | "par_level"
    | "par_period"
    | "par_unit"
  >,
): Partial<Pick<InventoryItemRow, "quantity" | "unit" | "cantidad_num" | "bolsas">> {
  if (!stockItemNeedsPurchase(stock)) return {}

  const fromPar = suggestedBuyFromParLevel(stock)
  if (Object.keys(fromPar).length > 0) return fromPar

  const out: Partial<
    Pick<InventoryItemRow, "quantity" | "unit" | "cantidad_num" | "bolsas">
  > = {}
  const status = findStockStatusForNotes(stock.notes)
  const unit = (stock.unit ?? "kg").trim().toLowerCase()

  const lowOrOut =
    status?.id === "agotado" ||
    status?.id === "poco" ||
    status?.id === "comprar_mas"

  if (out.quantity == null && lowOrOut && unit === "kg") {
    const onHand = Number(stock.quantity) || 0
    if (onHand > 0) {
      out.quantity = onHand
      out.unit = "kg"
    }
  }

  if (
    out.cantidad_num == null &&
    lowOrOut &&
    stock.cantidad_num != null &&
    stock.cantidad_num > 0
  ) {
    out.cantidad_num = stock.cantidad_num
  }

  if (out.bolsas == null && lowOrOut) {
    if (status?.id === "agotado") {
      out.bolsas = Math.max(1, stock.bolsas ?? 1)
    } else if (stock.bolsas != null && stock.bolsas > 0) {
      out.bolsas = stock.bolsas
    }
  }

  return out
}

export function shoppingHasBuyQuantity(
  item: Pick<
    InventoryItemRow,
    "quantity" | "unit" | "cantidad_num" | "bolsas"
  >,
): boolean {
  if (Number(item.quantity) > 0) return true
  if (item.cantidad_num != null && item.cantidad_num > 0) return true
  if (item.bolsas != null && item.bolsas > 0) return true
  return false
}

/** Human-readable buy line for shopping-list rows. */
export function shoppingBuyQuantityLabel(
  item: Pick<
    InventoryItemRow,
    "quantity" | "unit" | "cantidad_num" | "bolsas"
  >,
): string | null {
  const parts: string[] = []
  const kg = Number(item.quantity)
  if (kg > 0 && (item.unit ?? "kg").trim().toLowerCase() === "kg") {
    const label = stockQuantityLabelForItem(item)
    parts.push(`${label ?? kg} kg`)
  }
  if (item.cantidad_num != null && item.cantidad_num > 0) {
    parts.push(`${item.cantidad_num} pza`)
  }
  if (item.bolsas != null && item.bolsas > 0) {
    parts.push(
      `${item.bolsas} ${item.bolsas === 1 ? "bolsa" : "bolsas"}`,
    )
  }
  return parts.length ? parts.join(" · ") : null
}

export function mergeSuggestedBuyIntoShopping(
  shopping: InventoryItemRow | undefined,
  suggested: Partial<
    Pick<InventoryItemRow, "quantity" | "unit" | "cantidad_num" | "bolsas">
  >,
): Partial<
  Pick<InventoryItemRow, "quantity" | "unit" | "cantidad_num" | "bolsas">
> {
  const patch: Partial<
    Pick<InventoryItemRow, "quantity" | "unit" | "cantidad_num" | "bolsas">
  > = {}
  if (
    suggested.quantity != null &&
    suggested.quantity > 0 &&
    (!shopping || Number(shopping.quantity) <= 0)
  ) {
    patch.quantity = suggested.quantity
    patch.unit = suggested.unit ?? "kg"
  }
  if (
    suggested.cantidad_num != null &&
    suggested.cantidad_num > 0 &&
    (!shopping || !shopping.cantidad_num)
  ) {
    patch.cantidad_num = suggested.cantidad_num
  }
  if (
    suggested.bolsas != null &&
    suggested.bolsas > 0 &&
    (!shopping || !shopping.bolsas)
  ) {
    patch.bolsas = suggested.bolsas
  }
  return patch
}

export function normalizeInventoryItemName(name: string): string {
  return (name ?? "").trim().toLowerCase()
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
    (item.unit ?? "").trim().toLowerCase() === preset.unit.toLowerCase()
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
  if (q > 0 && (item.unit ?? "").trim().toLowerCase() === "kg") {
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

export type StockMarinatedOptionId = "yes" | "no"

export interface StockMarinatedOption {
  id: StockMarinatedOptionId
  label: string
  value: boolean
}

export const STOCK_MARINATED_OPTIONS: StockMarinatedOption[] = [
  { id: "yes", label: "Sí", value: true },
  { id: "no", label: "No", value: false },
]

export function stockMarinatedOptionForValue(
  marinated: boolean | null | undefined,
): StockMarinatedOption | undefined {
  if (marinated === true) {
    return STOCK_MARINATED_OPTIONS.find((o) => o.id === "yes")
  }
  if (marinated === false) {
    return STOCK_MARINATED_OPTIONS.find((o) => o.id === "no")
  }
  return undefined
}

export function stockMarinatedIsActive(
  item: Pick<InventoryItemRow, "marinated">,
  option: StockMarinatedOption,
): boolean {
  return item.marinated === option.value
}

export function stockMarinatedLabelForItem(
  item: Pick<InventoryItemRow, "marinated">,
): string | null {
  return stockMarinatedOptionForValue(item.marinated)?.label ?? null
}

/** @deprecated Use StockStatusOption */
export type StockQuickAction = StockStatusOption
/** @deprecated Use STOCK_STATUS_OPTIONS */
export const STOCK_QUICK_ACTIONS = STOCK_STATUS_OPTIONS
/** @deprecated Use stockStatusIsActive */
export const stockQuickActionIsActive = stockStatusIsActive
