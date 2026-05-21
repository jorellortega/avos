import type { InventoryItemRow } from "@/lib/inventario-types"
import {
  findStockBolsasPresetForItem,
  findStockCountPresetForItem,
  findStockQuantityPresetForItem,
  findStockStatusForNotes,
  STOCK_BOLSAS_PRESETS,
  STOCK_COUNT_PRESETS,
  STOCK_QUANTITY_PRESETS,
  STOCK_STATUS_OPTIONS,
} from "@/lib/inventario-types"

export interface InventoryScanResult {
  nombre: string | null
  estado: string | null
  cantidad_kilos: string | null
  cantidad: number | null
  bolsas: number | null
  notas?: string | null
}

export const INVENTORY_SCAN_SYSTEM_PROMPT = `Eres un asistente de inventario para una cocina de restaurante mexicano (Avos).
Analiza la foto del producto indicado y estima el inventario actual.

Responde SOLO con JSON válido (sin markdown) con estas claves:
- "nombre": nombre corto del producto (etiqueta, envase o aspecto), o null
- "estado": uno de "Lleno", "Mitad", "Poco", "Comprar más", "Agotado", o null si no puedes saber
- "cantidad_kilos": uno de "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", o null
- "cantidad": entero 1-50 (unidades/piezas sueltas), o null
- "bolsas": entero 1-10 (botellas o bolsas), o null
- "notas": string corto opcional con detalle visible (ej. "2 botes medio llenos")

Usa null cuando el campo no aplique al producto o no sea visible.`

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function matchEstado(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const n = norm(raw)
  const found = STOCK_STATUS_OPTIONS.find(
    (o) =>
      norm(o.label) === n ||
      norm(o.notes) === n ||
      (n === "full" && o.id === "full"),
  )
  return found?.notes ?? null
}

function matchKilos(raw: string | null | undefined): {
  quantity: number
  unit: string
} | null {
  if (!raw || typeof raw !== "string") return null
  const n = norm(raw)
  const preset = STOCK_QUANTITY_PRESETS.find((p) => norm(p.label) === n)
  if (preset) return { quantity: preset.quantity, unit: preset.unit }
  if (n === "1/4" || n === "¼") {
    return { quantity: 0.25, unit: "kg" }
  }
  if (n === "1/2" || n === "½" || n === "0.5") {
    return { quantity: 0.5, unit: "kg" }
  }
  const num = Number.parseFloat(n.replace(",", "."))
  if (!Number.isNaN(num) && num >= 0 && num <= 10) {
    const match = STOCK_QUANTITY_PRESETS.find(
      (p) => Math.abs(p.quantity - num) < 0.001,
    )
    if (match) return { quantity: match.quantity, unit: match.unit }
  }
  return null
}

function matchCount(raw: number | string | null | undefined): number | null {
  if (raw == null) return null
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isInteger(n) || n < 1 || n > 50) return null
  return n
}

function matchBolsas(raw: number | string | null | undefined): number | null {
  if (raw == null) return null
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isInteger(n) || n < 1 || n > 10) return null
  return n
}

export function parseInventoryScanJson(text: string): InventoryScanResult | null {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return {
      nombre:
        typeof raw.nombre === "string"
          ? raw.nombre.trim() || null
          : typeof raw.name === "string"
            ? raw.name.trim() || null
            : null,
      estado:
        typeof raw.estado === "string"
          ? raw.estado
          : raw.estado == null
            ? null
            : null,
      cantidad_kilos:
        typeof raw.cantidad_kilos === "string"
          ? raw.cantidad_kilos
          : typeof raw.cantidadKilos === "string"
            ? raw.cantidadKilos
            : null,
      cantidad: matchCount(
        typeof raw.cantidad === "number" || typeof raw.cantidad === "string"
          ? raw.cantidad
          : null,
      ),
      bolsas: matchBolsas(
        typeof raw.bolsas === "number" || typeof raw.bolsas === "string"
          ? raw.bolsas
          : null,
      ),
      notas:
        typeof raw.notas === "string"
          ? raw.notas
          : typeof raw.notes === "string"
            ? raw.notes
            : null,
    }
  } catch {
    return null
  }
}

export function patchesFromInventoryScan(
  scan: InventoryScanResult,
): Partial<InventoryItemRow> {
  const patch: Partial<InventoryItemRow> = {}

  if (scan.nombre?.trim()) patch.name = scan.nombre.trim()

  const estadoNotes = matchEstado(scan.estado)
  if (estadoNotes) patch.notes = estadoNotes

  const kilos = matchKilos(scan.cantidad_kilos)
  if (kilos) {
    patch.quantity = kilos.quantity
    patch.unit = kilos.unit
  }

  const count = matchCount(scan.cantidad)
  if (count != null) patch.cantidad_num = count

  const bolsas = matchBolsas(scan.bolsas)
  if (bolsas != null) patch.bolsas = bolsas

  return patch
}

/** Preview labels for UI after a scan. */
export function inventoryScanSummary(
  scan: InventoryScanResult,
  patch: Partial<InventoryItemRow>,
): string {
  const parts: string[] = []
  if (patch.name) parts.push(`Nombre: ${patch.name}`)
  if (patch.notes && findStockStatusForNotes(patch.notes)) {
    parts.push(`Estado: ${findStockStatusForNotes(patch.notes)!.label}`)
  }
  if (patch.quantity != null && patch.unit) {
    const k = findStockQuantityPresetForItem({
      quantity: patch.quantity,
      unit: patch.unit,
    })
    parts.push(`Kilos: ${k?.label ?? patch.quantity}`)
  }
  if (patch.cantidad_num != null) {
    parts.push(`Cantidad: ${patch.cantidad_num}`)
  }
  if (patch.bolsas != null) {
    parts.push(`Bolsas: ${patch.bolsas}`)
  }
  return parts.length ? parts.join(" · ") : "Sin cambios detectados"
}
