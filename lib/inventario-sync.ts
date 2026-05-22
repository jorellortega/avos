import type { InventoryItemRow, InventoryListKind } from "@/lib/inventario-types"
import {
  findStockStatusForNotes,
  normalizeInventoryItemName,
  shoppingNotesFromStock,
  stockItemNeedsPurchase,
  STOCK_ACTION_OPTIONS,
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

  const notes = shoppingNotesFromStock(stock)
  const patch: Partial<InventoryItemRow> = {
    notes,
    purchased: false,
  }
  if (stock.image_url.trim()) {
    patch.image_url = stock.image_url.trim()
  }
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
  return !items.some((row) => row.list_kind === "stock" && normalizeInventoryItemName(row.name) === key)
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
    notes: patch?.notes ?? STOCK_BUY_NOTES,
    list_kind: "stock",
    purchased: false,
    is_active: true,
    sort_order: sortOrder,
  }
}
