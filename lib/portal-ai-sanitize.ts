import { bebidas, categorias, getPlatillosForCategoria, proteinas } from "@/lib/menu-data"
import type { BebidaTamano } from "@/lib/menu-data"
import type { PortalAiLineInput } from "@/lib/portal-menu-snapshot"

const SEGMENT_SPLIT = /[,;]|\s+\by\b|\s+\band\b/i

const PROTEIN_ALIASES = [
  "asada",
  "pollo",
  "pastor",
  "camaron",
  "camarón",
  "shrimp",
  "carne asada",
  "pollo asado",
] as const

const GENERIC_DRINK_RE =
  /\b(drink|drinks|bebida|bebidas|refresco|refrescos|soda|pop)\b/i

const BEBIDA_FLAVOR_KEYWORDS: string[] = [
  ...bebidas.map((b) => b.id),
  ...bebidas.map((b) => b.nombre.toLowerCase()),
  "jamaica",
  "horchata",
  "piña",
  "pina",
  "limon",
  "limón",
  "pepino",
  "mango",
  "alfalfa",
  "naranja",
  "melon",
  "melón",
  "sandia",
  "sandía",
  "michelada",
]

const GENERIC_BEBIDA_IDS = new Set([
  "agua",
  "water",
  "bebida",
  "bebidas",
  "drink",
  "drinks",
  "refresco",
  "soda",
])

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

function splitMessageSegments(message: string): string[] {
  return message
    .split(SEGMENT_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function segmentMentionsProtein(segment: string): boolean {
  const s = normalizeText(segment)
  if (PROTEIN_ALIASES.some((a) => s.includes(normalizeText(a)))) return true
  return proteinas.some((p) => s.includes(normalizeText(p)))
}

function segmentMentionsBebidaFlavor(segment: string): boolean {
  const s = normalizeText(segment)
  for (const b of bebidas) {
    if (s.includes(normalizeText(b.id))) return true
    const flavor = normalizeText(b.nombre).replace(/^agua de\s+/, "")
    if (flavor.length > 2 && s.includes(flavor)) return true
  }
  return BEBIDA_FLAVOR_KEYWORDS.some((k) => s.includes(normalizeText(k)))
}

function isKnownBebidaId(bebidaId: string): boolean {
  return bebidas.some((b) => b.id === bebidaId)
}

/** AI often returns bebidaId "agua" — not a real menu id; treat as pick-a-flavor. */
export function coerceUnknownBebidaLines(
  lines: PortalAiLineInput[],
): PortalAiLineInput[] {
  return lines.map((line) => {
    if (!line.bebidaId) return line
    if (isKnownBebidaId(line.bebidaId)) return line

    const id = normalizeText(line.bebidaId)
    if (GENERIC_BEBIDA_IDS.has(id)) {
      const { bebidaId: _id, ...rest } = line
      return { ...rest, categoriaId: "bebidas" }
    }

    const fuzzy = bebidas.find(
      (b) => id.includes(normalizeText(b.id)) || normalizeText(b.id).includes(id),
    )
    if (fuzzy) return { ...line, bebidaId: fuzzy.id }

    const { bebidaId: _id, ...rest } = line
    return { ...rest, categoriaId: "bebidas" }
  })
}

function attachBebidaTamanoFromSegments(
  lines: PortalAiLineInput[],
  segments: string[],
): PortalAiLineInput[] {
  return lines.map((line) => {
    if (line.bebidaTamano) return line
    if (line.categoriaId !== "bebidas" && !line.bebidaId) return line
    if (line.bebidaId && isKnownBebidaId(line.bebidaId)) return line

    const seg = segments.find((s) => {
      const n = normalizeText(s)
      return (
        /\b(agua|bebida|drink|refresco|horchata|jamaica)\b/.test(n) ||
        bebidas.some((b) => n.includes(normalizeText(b.id)))
      )
    })
    if (!seg) return line
    const tam = segmentBebidaTamano(seg)
    return tam ? { ...line, bebidaTamano: tam } : line
  })
}

export function segmentIsGenericDrink(segment: string): boolean {
  const s = segment.toLowerCase()
  if (!GENERIC_DRINK_RE.test(s) && !/\b(water|agua)\b/i.test(s)) return false
  return !segmentMentionsBebidaFlavor(segment)
}

export function segmentBebidaTamano(segment: string): BebidaTamano | undefined {
  if (/\b(large|grande|big)\b/i.test(segment)) return "grande"
  if (/\b(small|chico|pequeño|pequeno)\b/i.test(segment)) return "chico"
  return undefined
}

function scoreSegmentForPlatilloLine(
  segment: string,
  line: PortalAiLineInput,
): number {
  const seg = normalizeText(segment)
  let score = 0
  const catId = line.categoriaId
  const platilloId = line.platilloId ?? line.categoriaId

  if (catId === "tacos" && /\btacos?\b/.test(seg)) score += 12
  else if (seg.includes(normalizeText(catId))) score += 10
  else if (platilloId && seg.includes(normalizeText(platilloId))) score += 8

  const qty = line.cantidad
  if (qty > 1 && new RegExp(`\\b${qty}\\b`).test(seg)) score += 25
  else if (qty === 1 && !/\b[2-9]\d*\b/.test(seg)) score += 8

  if (line.proteina && segmentMentionsProtein(segment)) {
    const p = normalizeText(line.proteina)
    if (seg.includes(p)) score += 20
  }

  return score
}

function assignPlatilloSegments(
  lines: PortalAiLineInput[],
  segments: string[],
): Map<number, string> {
  const assignments = new Map<number, string>()
  const usedSegments = new Set<number>()

  const platilloIndices = lines
    .map((line, i) => ({ line, i }))
    .filter(
      ({ line }) =>
        line.categoriaId !== "bebidas" && !line.bebidaId && line.categoriaId,
    )

  for (const { line, i } of platilloIndices) {
    let bestIdx = -1
    let bestScore = 0
    for (let si = 0; si < segments.length; si++) {
      if (usedSegments.has(si)) continue
      const score = scoreSegmentForPlatilloLine(segments[si], line)
      if (score > bestScore) {
        bestScore = score
        bestIdx = si
      }
    }
    if (bestIdx >= 0 && bestScore >= 10) {
      usedSegments.add(bestIdx)
      assignments.set(i, segments[bestIdx])
    }
  }

  return assignments
}

function segmentMatchesBebidaLine(
  segment: string,
  line: PortalAiLineInput,
): boolean {
  if (!line.bebidaId) return false
  const s = normalizeText(segment)
  const bebida = bebidas.find((b) => b.id === line.bebidaId)
  if (!bebida) return false
  return (
    s.includes(normalizeText(bebida.id)) ||
    s.includes(normalizeText(bebida.nombre)) ||
    BEBIDA_FLAVOR_KEYWORDS.some(
      (k) => s.includes(normalizeText(k)) && normalizeText(bebida.nombre).includes(normalizeText(k)),
    )
  )
}

function findMissingGenericDrinkLines(
  segments: string[],
  lines: PortalAiLineInput[],
): PortalAiLineInput[] {
  const extra: PortalAiLineInput[] = []

  for (const segment of segments) {
    if (!segmentIsGenericDrink(segment)) continue

    const covered = lines.some(
      (line) =>
        line.bebidaId &&
        (segmentMatchesBebidaLine(segment, line) ||
          (!segmentMentionsBebidaFlavor(segment) && line.categoriaId === "bebidas")),
    )
    if (covered) continue

    const qtyMatch = segment.match(/\b(\d+)\b/)
    const cantidad = qtyMatch ? Math.max(1, parseInt(qtyMatch[1], 10)) : 1
    const bebidaTamano = segmentBebidaTamano(segment)

    extra.push({
      categoriaId: "bebidas",
      cantidad,
      ...(bebidaTamano ? { bebidaTamano } : {}),
    })
  }

  return extra
}

/**
 * Stops the AI from "completing" items the staff left vague (e.g. "tacos" without asada).
 */
export function sanitizePortalAiLinesFromMessage(
  lines: PortalAiLineInput[],
  message: string,
): PortalAiLineInput[] {
  const segments = splitMessageSegments(message)
  if (segments.length === 0) return lines

  const assignments = assignPlatilloSegments(lines, segments)

  const sanitized = lines.map((line, index) => {
    if (line.bebidaId || line.categoriaId === "bebidas") {
      if (!line.bebidaId) return line
      const seg = segments.find((s) => segmentMatchesBebidaLine(s, line))
      if (seg && !segmentMentionsBebidaFlavor(seg) && line.bebidaTamano) {
        const { bebidaTamano, ...rest } = line
        return rest
      }
      if (seg && segmentBebidaTamano(seg) == null && line.bebidaTamano) {
        const { bebidaTamano, ...rest } = line
        return rest
      }
      return line
    }

    const cat = categorias.find((c) => c.id === line.categoriaId)
    const platilloId = line.platilloId ?? line.categoriaId
    const platillo = cat
      ? getPlatillosForCategoria(cat).find((p) => p.id === platilloId)
      : undefined
    if (platillo?.tieneProteinas === false || !line.proteina) return line

    const segment = assignments.get(index)
    if (segment && !segmentMentionsProtein(segment)) {
      const { proteina: _p, ...rest } = line
      return rest
    }

    return line
  })

  let result = [...sanitized, ...findMissingGenericDrinkLines(segments, sanitized)]
  result = coerceUnknownBebidaLines(result)
  result = attachBebidaTamanoFromSegments(result, segments)
  return result
}
