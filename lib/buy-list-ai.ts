export type BuyListScanResult = {
  items: string[]
  notes?: string
}

export const BUY_LIST_SCAN_SYSTEM_PROMPT = `Eres un asistente que lee listas de compras.
Analiza la entrada (foto de lista, recibo, pizarra, nota o texto) y extrae cada artículo por comprar.

Responde SOLO JSON válido:
{
  "items": ["artículo 1", "artículo 2"],
  "notes": "opcional: una frase si algo no se leyó bien"
}

Reglas:
- items: nombres cortos y claros en español (o el idioma de la lista).
- Un artículo por elemento; no agrupes todo en una sola cadena.
- Incluye cantidades solo si aparecen (ej. "2 kg tomate", "3 cebollas").
- Orden: de arriba a abajo como en la imagen o el texto.
- Sin numeración en el texto del item (el UI numerará).
- Si no hay artículos legibles, items: [].`

export function parseBuyListScanJson(raw: string): BuyListScanResult | null {
  try {
    const j = JSON.parse(raw) as BuyListScanResult
    if (!j || typeof j !== "object" || !Array.isArray(j.items)) return null
    const items = j.items
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)
    return {
      items,
      notes: typeof j.notes === "string" ? j.notes.trim() || undefined : undefined,
    }
  } catch {
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start < 0 || end <= start) return null
    try {
      return parseBuyListScanJson(raw.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

/** Split manual textarea into line items (no AI). */
export function linesToBuyItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
}

export function createBuyListItemId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export type BuyListItem = {
  id: string
  text: string
  done: boolean
}

export function stringsToBuyListItems(lines: string[]): BuyListItem[] {
  return lines.map((text) => ({
    id: createBuyListItemId(),
    text,
    done: false,
  }))
}
