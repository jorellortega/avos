import type { InventoryItemRow, InventoryListKind } from "@/lib/inventario-types"
import {
  findStockStatusForNotes,
  mergeInventoryPricesFromSource,
  mergeSuggestedBuyIntoShopping,
  normalizeInventoryPrice,
  normalizeInventoryItemName,
  shoppingHasBuyQuantity,
  shoppingNotesFromStock,
  isAutoSyncedShoppingNotes,
  resolveShoppingListNotes,
  stockItemNeedsPurchase,
  suggestedBuyFromStock,
  STOCK_ACTION_OPTIONS,
  STOCK_STATUS_NEEDS_BUY,
  STOCK_STATUS_OPTIONS,
} from "@/lib/inventario-types"

export function findInventoryByName(
  items: InventoryItemRow[],
  name: string,
  listKind: InventoryListKind,
): InventoryItemRow | undefined {
  const key = normalizeInventoryItemName(name)
  if (!key) return undefined
  return items.find(
    (row) =>
      row.list_kind === listKind &&
      normalizeInventoryItemName(row.name) === key,
  )
}

const STOCK_FULL_NOTES =
  STOCK_STATUS_OPTIONS.find((o) => o.id === "full")?.notes ?? "Lleno"
const STOCK_BUY_NOTES =
  STOCK_STATUS_OPTIONS.find((o) => o.id === "comprar_mas")?.notes ?? "Comprar más"
const STOCK_BUY_ACTION =
  STOCK_ACTION_OPTIONS.find((o) => o.id === "buy_now")?.value ?? "Comprar ahora"

/** Clear stale buy flags on stock when par is met or purchase no longer needed. */
export function stockPatchWhenPurchaseResolved(
  stock: InventoryItemRow,
): Partial<InventoryItemRow> | null {
  if (stock.list_kind !== "stock") return null
  if (stockItemNeedsPurchase(stock)) return null

  const patch: Partial<InventoryItemRow> = {}
  if (stock.stock_action.trim()) {
    patch.stock_action = ""
  }
  const status = findStockStatusForNotes(stock.notes)
  if (status && STOCK_STATUS_NEEDS_BUY.includes(status.id)) {
    patch.notes = STOCK_FULL_NOTES
  }
  return Object.keys(patch).length > 0 ? patch : null
}

/** Shopping row changes when stock was updated. */
export function shoppingPatchFromStock(
  stock: InventoryItemRow,
  shopping: InventoryItemRow | undefined,
): Partial<InventoryItemRow> | null {
  if (stock.list_kind !== "stock") return null

  const needs = stockItemNeedsPurchase(stock)

  if (!needs) {
    if (shopping && !shopping.purchased) {
      return { purchased: true }
    }
    return null
  }

  const notes = resolveShoppingListNotes(stock)
  const suggested = suggestedBuyFromStock(stock)
  const patch: Partial<InventoryItemRow> = {
    purchased: false,
    ...mergeSuggestedBuyIntoShopping(shopping, suggested),
  }
  const buyNote = (stock.buy_note ?? "").trim()
  if (!shopping) {
    patch.notes = notes
  } else if (
    buyNote ||
    (!shoppingHasBuyQuantity(shopping) &&
      (!shopping.notes.trim() || isAutoSyncedShoppingNotes(shopping.notes)))
  ) {
    patch.notes = notes
  }
  if (stock.image_url.trim()) {
    patch.image_url = stock.image_url.trim()
  }
  Object.assign(patch, mergeInventoryPricesFromSource(shopping, stock))
  if (shopping && normalizeInventoryItemName(shopping.name) !== normalizeInventoryItemName(stock.name)) {
    patch.name = stock.name.trim()
  }
  return patch
}

export function shouldCreateShoppingFromStock(
  stock: InventoryItemRow,
  items: InventoryItemRow[],
): boolean {
  if (!stockItemNeedsPurchase(stock)) return false
  const key = normalizeInventoryItemName(stock.name)
  if (!key) return false
  return !items.some((row) => row.list_kind === "shopping" && normalizeInventoryItemName(row.name) === key)
}

/** Stock row changes when shopping list was updated. */
export function stockPatchFromShopping(
  shopping: InventoryItemRow,
  stock: InventoryItemRow | undefined,
): Partial<InventoryItemRow> | null {
  if (shopping.list_kind !== "shopping") return null
  const name = shopping.name.trim()
  if (!name) return null

  const imagePatch =
    shopping.image_url.trim() !== ""
      ? { image_url: shopping.image_url.trim() }
      : {}

  if (shopping.purchased) {
    return {
      notes: STOCK_FULL_NOTES,
      stock_action: "",
      ...imagePatch,
      ...(stock && normalizeInventoryItemName(stock.name) !== normalizeInventoryItemName(name)
        ? { name }
        : {}),
    }
  }

  const existingStatus = stock ? findStockStatusForNotes(stock.notes) : undefined
  const notes =
    existingStatus?.id === "agotado"
      ? existingStatus.notes
      : STOCK_BUY_NOTES

  return {
    notes,
    stock_action: STOCK_BUY_ACTION,
    ...imagePatch,
    ...mergeInventoryPricesFromSource(stock, shopping),
    ...(stock && normalizeInventoryItemName(stock.name) !== normalizeInventoryItemName(name)
      ? { name }
      : {}),
  }
}

export function shouldCreateStockFromShopping(
  shopping: InventoryItemRow,
  items: InventoryItemRow[],
): boolean {
  if (shopping.list_kind !== "shopping" || shopping.purchased) return false
  const key = normalizeInventoryItemName(shopping.name)
  if (!key) return false
  return !items.some(
    (row) =>
      row.list_kind === "stock" &&
      normalizeInventoryItemName(row.name) === key,
  )
}

/** Insert payload when creating a shopping row from stock. */
export function shoppingInsertFromStock(
  stock: InventoryItemRow,
  sortOrder: number,
): Omit<InventoryItemRow, "id" | "created_at" | "updated_at"> {
  const suggested = suggestedBuyFromStock(stock)
  const name = stock.name.trim()
  return {
    name,
    notes: resolveShoppingListNotes(stock),
    list_kind: "shopping",
    unit: suggested.unit ?? "kg",
    quantity: suggested.quantity ?? 0,
    purchased: false,
    is_active: true,
    sort_order: sortOrder,
    image_url: stock.image_url.trim(),
    category: "",
    stock_action: "",
    bolsas: suggested.bolsas ?? null,
    cantidad_num: suggested.cantidad_num ?? null,
    marinated: null,
    par_level: null,
    par_period: null,
    par_unit: null,
    price_min: normalizeInventoryPrice(stock.price_min),
    price_max: normalizeInventoryPrice(stock.price_max),
    buy_note: "",
  }
}

export function emptyStockRowFromShopping(
  shopping: InventoryItemRow,
  defaultCategory: string,
  sortOrder: number,
): Omit<InventoryItemRow, "id" | "created_at" | "updated_at"> {
  const patch = stockPatchFromShopping(shopping, undefined)
  return {
    name: shopping.name.trim(),
    image_url: shopping.image_url.trim(),
    category: defaultCategory,
    unit: "kg",
    quantity: 0,
    bolsas: null,
    cantidad_num: null,
    marinated: null,
    stock_action: patch?.stock_action ?? STOCK_BUY_ACTION,
    par_level: null,
    par_period: null,
    par_unit: null,
    price_min: normalizeInventoryPrice(shopping.price_min),
    price_max: normalizeInventoryPrice(shopping.price_max),
    notes: patch?.notes ?? STOCK_BUY_NOTES,
    buy_note: "",
    list_kind: "stock",
    purchased: false,
    is_active: true,
    sort_order: sortOrder,
  }
}
