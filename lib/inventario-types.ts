export type InventoryListKind = "stock" | "shopping"

export interface InventoryItemRow {
  id: string
  name: string
  category: string
  unit: string
  quantity: number
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

export function isLowStock(item: InventoryItemRow): boolean {
  if (item.list_kind !== "stock") return false
  if (item.par_level == null || item.par_level <= 0) return false
  return item.quantity < item.par_level
}
