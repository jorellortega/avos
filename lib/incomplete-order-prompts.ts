import {
  getCategoriaById,
  getPlatillosForCategoria,
  getPlatilloTamanoLabel,
  proteinas,
  bebidas,
} from "@/lib/menu-data"
import { parseCartLineBaseId } from "@/lib/portal-cart-item"
import type { PortalOrderLineBreakdown } from "@/lib/portal-menu-snapshot"

export function orderLinesIncomplete(
  lines: PortalOrderLineBreakdown[],
): boolean {
  return lines.some(
    (l) =>
      l.needsProteina ||
      l.needsPlatilloTamano ||
      l.needsBebidaTamano ||
      l.needsBebidaEleccion,
  )
}

function stripIncompleteLabel(nombre: string): string {
  return nombre
    .replace(/\s*\(elige proteína y tamaño\)/gi, "")
    .replace(/\s*\(elige proteína\)/gi, "")
    .replace(/\s*\(elige tamaño\)/gi, "")
    .trim()
}

function platilloTamanoPrompt(line: PortalOrderLineBreakdown): string {
  const name = stripIncompleteLabel(line.nombre)
  const parsed = parseCartLineBaseId(line.id)
  if (parsed) {
    const cat = getCategoriaById(parsed.categoriaId)
    const platillo = cat
      ? getPlatillosForCategoria(cat).find((p) => p.id === parsed.platilloId)
      : undefined
    if (platillo?.tieneTamanos) {
      const chico = getPlatilloTamanoLabel(platillo, "chico")
      const grande = getPlatilloTamanoLabel(platillo, "grande")
      if (line.cantidad > 1) {
        return `¿Los ${line.cantidad} ${name} ${chico} o ${grande}?`
      }
      return `¿${name} ${chico} o ${grande}?`
    }
  }
  if (line.cantidad > 1) {
    return `¿Los ${line.cantidad} ${name} chico o grande?`
  }
  return `¿${name} chico o grande?`
}

/** Spanish follow-up questions when cart lines are missing protein, size, or drink. */
export function buildIncompleteOrderFollowUp(
  lines: PortalOrderLineBreakdown[],
): string | null {
  if (!orderLinesIncomplete(lines)) return null

  const questions: string[] = []

  for (const line of lines.filter((l) => l.needsProteina)) {
    const name = stripIncompleteLabel(line.nombre)
    const protList = proteinas.join(", ")
    if (line.cantidad > 1) {
      questions.push(
        `¿Qué proteína quieres para los ${line.cantidad} ${name}? Tenemos: ${protList}.`,
      )
    } else {
      questions.push(
        `¿Qué proteína quieres para ${name}? Tenemos: ${protList}.`,
      )
    }
  }

  for (const line of lines.filter((l) => l.needsPlatilloTamano && !l.needsProteina)) {
    questions.push(platilloTamanoPrompt(line))
  }

  for (const line of lines.filter((l) => l.needsBebidaEleccion)) {
    const drinkList = bebidas.map((b) => b.nombre).join(", ")
    questions.push(`¿Qué bebida te gustaría? Tenemos: ${drinkList}.`)
  }

  for (const line of lines.filter((l) => l.needsBebidaTamano)) {
    const name = stripIncompleteLabel(line.nombre)
    if (line.cantidad > 1) {
      questions.push(`¿${line.cantidad} ${name} chico o grande?`)
    } else {
      questions.push(`¿${name} chico o grande?`)
    }
  }

  if (questions.length === 0) return null

  const header =
    questions.length === 1
      ? "Para completar tu pedido:"
      : "Para completar tu pedido, necesito unos detalles:"

  return `${header}\n\n${questions.join("\n\n")}`
}

function formatSpanishList(parts: string[]): string {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`
}

function lineToNaturalPhrase(line: PortalOrderLineBreakdown): string {
  let phrase = stripIncompleteLabel(line.nombre)
    .replace(/\s*\(([^)]+)\)\s*/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^Tortas\b/i, "torta")
    .replace(/^Tacos\b/i, "taco")
    .replace(/^Taco\b/i, "taco")
    .replace(/^Quesadillas\b/i, "quesadilla")
    .replace(/^Quesadilla\b/i, "quesadilla")
    .toLowerCase()

  if (line.cantidad === 1) return `1 ${phrase}`

  phrase = phrase
    .replace(/^taco\b/, "tacos")
    .replace(/^torta\b/, "tortas")
    .replace(/^quesadilla\b/, "quesadillas")
    .replace(/\bgrande\b/, "grandes")
    .replace(/\bchica\b/, "chicas")
    .replace(/\bchico\b/, "chicos")

  return `${line.cantidad} ${phrase}`
}

/** Natural Spanish confirmation when every cart line is complete. */
export function buildOrderConfirmationMessage(
  lines: PortalOrderLineBreakdown[],
  total: number,
): string {
  const complete = lines.filter(
    (l) =>
      !l.needsProteina &&
      !l.needsPlatilloTamano &&
      !l.needsBebidaTamano &&
      !l.needsBebidaEleccion,
  )
  if (complete.length === 0) {
    return `Total $${total.toFixed(0)}.`
  }

  const parts = complete.map(lineToNaturalPhrase)
  return `Perfecto — quieres ${formatSpanishList(parts)}. Total $${total.toFixed(0)}.`
}
