import type { OrderItem } from "@/components/orders-provider"
import {
  MENU_CATALOG_KEY,
  type MenuCatalogJson,
  parseMenuCatalogJson,
  serializeMenuCatalogJson,
} from "@/lib/menu-catalog-shared"
import { createBrowserSupabase } from "@/lib/supabase/client"

/** Extract bebida catalog id from portal cart line id (`horchata-chico`, etc.). */
export function bebidaIdFromOrderItem(item: OrderItem): string | null {
  if (item.bebidaId?.trim()) return item.bebidaId.trim()
  if (item.categoria !== "bebidas") return null
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

export function cloneMenuCatalogJson(j: MenuCatalogJson): MenuCatalogJson {
  return parseMenuCatalogJson(serializeMenuCatalogJson(j))
}

function bebidaQtyById(items: OrderItem[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const bebidaId = bebidaIdFromOrderItem(item)
    if (!bebidaId) continue
    counts.set(
      bebidaId,
      (counts.get(bebidaId) ?? 0) + Math.max(1, item.cantidad),
    )
  }
  return counts
}

/** Subtract only net-new drink lines vs a previous cart (avoids double-decrement on re-save). */
export function applyBebidaStockDelta(
  json: MenuCatalogJson,
  beforeItems: OrderItem[],
  afterItems: OrderItem[],
): MenuCatalogJson {
  const tracking = new Set(json.bebidaTrackStock ?? [])
  if (tracking.size === 0) return json

  const before = bebidaQtyById(beforeItems)
  const after = bebidaQtyById(afterItems)
  const sold = new Map<string, number>()
  for (const [id, n] of after) {
    if (!tracking.has(id)) continue
    const delta = n - (before.get(id) ?? 0)
    if (delta > 0) sold.set(id, delta)
  }
  if (sold.size === 0) return json

  const next = cloneMenuCatalogJson(json)
  const qtyMap = { ...(next.bebidaStockQty ?? {}) }
  for (const [id, n] of sold) {
    const prev = qtyMap[id] ?? 0
    qtyMap[id] = Math.max(0, prev - n)
  }
  next.bebidaStockQty = qtyMap
  return next
}

/** Subtract sold drink quantities from catalog stock (only tracked drinks). */
export function applyBebidaStockForSoldItems(
  json: MenuCatalogJson,
  items: OrderItem[],
): MenuCatalogJson {
  return applyBebidaStockDelta(json, [], items)
}

export async function saveMenuCatalogJson(
  json: MenuCatalogJson,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createBrowserSupabase()
    const { error } = await supabase
      .from("ai_settings")
      .update({ setting_value: serializeMenuCatalogJson(json) })
      .eq("setting_key", MENU_CATALOG_KEY)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el menú.",
    }
  }
}
