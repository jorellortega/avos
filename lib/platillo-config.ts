import type {
  BebidaTamano,
  CategoriaMenu,
  CategoriaPlatillo,
  ProteinaPlatillo,
} from "@/lib/menu-data"
import { isProteinaRegular } from "@/lib/menu-data"
import { getPlatilloTamanoLabel } from "@/lib/menu-data"

/** Customer-facing label when proteina is Regular (e.g. quesadilla de queso). */
export function regularProteinaCustomerLabel(
  categoriaId: string,
): string | null {
  if (categoriaId === "quesadillas") return "Queso"
  return null
}

export function proteinaDisplayLabel(
  proteina: ProteinaPlatillo,
  categoriaId: string,
): string {
  if (isProteinaRegular(proteina)) {
    return regularProteinaCustomerLabel(categoriaId) ?? proteina
  }
  return proteina
}

export function platilloProteinaDisplayNombre(
  baseNombre: string,
  proteina: ProteinaPlatillo | undefined,
  categoriaId: string,
): string {
  if (!proteina) return baseNombre
  if (isProteinaRegular(proteina)) {
    const regularLabel = regularProteinaCustomerLabel(categoriaId)
    return regularLabel ? `${baseNombre} de ${regularLabel}` : baseNombre
  }
  return `${baseNombre} de ${proteina}`
}

export type PlatilloPickerFlags = {
  tieneProteinas: boolean
  tieneTamanos: boolean
  tieneOpciones: boolean
}

export function categoriaTieneProteinas(categoria: CategoriaMenu): boolean {
  return (categoria as { tieneProteinas?: boolean }).tieneProteinas !== false
}

/** Whether the UI should show a protein picker (matches platilloPickerFlags). */
export function resolvePlatilloTieneProteinas(
  platillo: Pick<
    CategoriaPlatillo,
    "tieneProteinas" | "opciones"
  >,
  categoria: Pick<CategoriaMenu, "tieneProteinas">,
): boolean {
  if ((platillo.opciones?.length ?? 0) > 0) return false
  if (platillo.tieneProteinas === false) return false
  if (platillo.tieneProteinas === true) return true
  return categoriaTieneProteinas(categoria)
}

export function platilloPickerFlags(
  platillo: CategoriaPlatillo,
  categoria: CategoriaMenu,
): PlatilloPickerFlags {
  const tieneTamanos = platillo.tieneTamanos === true
  const tieneOpciones = (platillo.opciones?.length ?? 0) > 0
  const tieneProteinas = tieneOpciones
    ? false
    : platillo.tieneProteinas === false
      ? false
      : platillo.tieneProteinas === true || categoriaTieneProteinas(categoria)
  return { tieneProteinas, tieneTamanos, tieneOpciones }
}

export function platilloCartSuffix(
  flags: PlatilloPickerFlags,
  tamano?: BebidaTamano,
  proteina?: ProteinaPlatillo,
  opcionId?: string,
): string {
  if (flags.tieneTamanos && flags.tieneProteinas) {
    return `${tamano ?? "chico"}-${proteina ?? "default"}`
  }
  if (flags.tieneTamanos && flags.tieneOpciones) {
    return `${tamano ?? "chico"}-${opcionId ?? "default"}`
  }
  if (flags.tieneTamanos && tamano) return tamano
  if (flags.tieneProteinas && proteina) return proteina
  if (flags.tieneOpciones && opcionId) return opcionId
  return proteina ?? opcionId ?? "default"
}

export function platilloLineNombre(
  baseNombre: string,
  flags: PlatilloPickerFlags,
  tamano?: BebidaTamano,
  proteina?: ProteinaPlatillo,
  platillo?: Pick<
    CategoriaPlatillo,
    "tamanoLabelChico" | "tamanoLabelGrande" | "opciones"
  >,
  opcionId?: string,
  categoriaId?: string,
): string {
  const tamLabel =
    tamano && platillo ? getPlatilloTamanoLabel(platillo, tamano) : undefined
  if (flags.tieneOpciones && opcionId) {
    const opcionLabel =
      platillo?.opciones?.find((o) => o.id === opcionId)?.label ?? opcionId
    return flags.tieneTamanos && tamLabel
      ? `${baseNombre} (${tamLabel}) — ${opcionLabel}`
      : `${baseNombre} — ${opcionLabel}`
  }
  if (flags.tieneProteinas && proteina && !isProteinaRegular(proteina)) {
    return flags.tieneTamanos && tamLabel
      ? `${baseNombre} (${tamLabel}) de ${proteina}`
      : `${baseNombre} de ${proteina}`
  }
  if (flags.tieneProteinas && isProteinaRegular(proteina)) {
    const base = categoriaId
      ? platilloProteinaDisplayNombre(baseNombre, proteina, categoriaId)
      : baseNombre
    if (tamLabel) return `${base} (${tamLabel})`
    return base
  }
  if (flags.tieneTamanos && tamLabel) {
    return `${baseNombre} (${tamLabel})`
  }
  return baseNombre
}
