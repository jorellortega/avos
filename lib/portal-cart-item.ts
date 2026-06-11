import type { OrderItem } from "@/components/orders-provider"
import {
  bebidas,
  categorias,
  getCategoriaById,
  getBebidaPrecioDefault,
  getPlatillosForCategoria,
  proteinas,
  bebidaTamanoLabels,
  type BebidaTamano,
  type Proteina,
} from "@/lib/menu-data"
import type { MenuCatalogHelpers } from "@/lib/menu-catalog-shared"
import {
  platilloCartSuffix,
  platilloLineNombre,
  platilloPickerFlags,
} from "@/lib/platillo-config"

export const PORTAL_INCOMPLETE_PROTEIN_SUFFIX = "pendiente"
export const PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX = "platillo-tamano-pendiente"
export const PORTAL_INCOMPLETE_BEBIDA_SUFFIX = "tamano-pendiente"
export const PORTAL_INCOMPLETE_BEBIDA_CHOICE_SUFFIX = "bebida-pendiente"

export function parseCartLineBaseId(itemId: string): {
  categoriaId: string
  platilloId: string
  proteina?: Proteina
} | null {
  const baseId = itemId.split("::")[0]
  for (const cat of categorias) {
    const prefix = `${cat.id}-`
    if (!baseId.startsWith(prefix)) continue
    const tail = baseId.slice(prefix.length)
    for (const p of proteinas) {
      if (tail.endsWith(`-${p}-${PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX}`)) {
        return {
          categoriaId: cat.id,
          platilloId: tail.slice(
            0,
            -`-${p}-${PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX}`.length,
          ),
          proteina: p,
        }
      }
    }
    if (tail.endsWith(`-${PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX}`)) {
      return {
        categoriaId: cat.id,
        platilloId: tail.slice(
          0,
          -`-${PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX}`.length,
        ),
      }
    }
    if (tail.endsWith(`-${PORTAL_INCOMPLETE_PROTEIN_SUFFIX}`)) {
      return {
        categoriaId: cat.id,
        platilloId: tail.slice(0, -`-${PORTAL_INCOMPLETE_PROTEIN_SUFFIX}`.length),
      }
    }
    if (tail.endsWith("-default")) {
      return {
        categoriaId: cat.id,
        platilloId: tail.slice(0, -"-default".length),
      }
    }
    for (const tam of ["chico", "grande"] as const) {
      if (tail.endsWith(`-${tam}`)) {
        const platilloId = tail.slice(0, -`-${tam}`.length)
        const catObj = getCategoriaById(cat.id)
        const plat = catObj
          ? getPlatillosForCategoria(catObj).find((p) => p.id === platilloId)
          : undefined
        if (plat?.tieneTamanos) {
          return { categoriaId: cat.id, platilloId }
        }
      }
    }
    for (const p of proteinas) {
      const suf = `-${p}`
      if (tail.endsWith(suf)) {
        const beforeProt = tail.slice(0, -suf.length)
        for (const tam of ["chico", "grande"] as const) {
          const tamSuf = `-${tam}`
          if (beforeProt.endsWith(tamSuf)) {
            const platilloId = beforeProt.slice(0, -tamSuf.length)
            const catObj = getCategoriaById(cat.id)
            const plat = catObj
              ? getPlatillosForCategoria(catObj).find((x) => x.id === platilloId)
              : undefined
            if (plat?.tieneTamanos) {
              return { categoriaId: cat.id, platilloId, proteina: p }
            }
          }
        }
        return {
          categoriaId: cat.id,
          platilloId: beforeProt,
          proteina: p,
        }
      }
    }
  }
  return null
}

export function parseBebidaItemId(itemId: string): {
  bebidaId: string
  tamano?: BebidaTamano
} | null {
  const base = itemId.split("::")[0]
  if (base.endsWith(`-${PORTAL_INCOMPLETE_BEBIDA_SUFFIX}`)) {
    return {
      bebidaId: base.slice(0, -`-${PORTAL_INCOMPLETE_BEBIDA_SUFFIX}`.length),
    }
  }
  for (const tam of ["chico", "grande"] as const) {
    if (base.endsWith(`-${tam}`)) {
      const bebidaId = base.slice(0, -`-${tam}`.length)
      if (bebidas.some((b) => b.id === bebidaId) || bebidaId.length > 0) {
        return { bebidaId, tamano: tam }
      }
    }
  }
  return null
}

export function cartItemNeedsCompletion(item: OrderItem): boolean {
  return Boolean(
    item.needsProteina ||
      item.needsPlatilloTamano ||
      item.needsBebidaTamano ||
      item.needsBebidaEleccion,
  )
}

export function cartItemSupportsProtein(item: OrderItem): boolean {
  if (item.needsProteina) return true
  if (item.categoria === "bebidas") return false
  const parsed = parseCartLineBaseId(item.id)
  if (!parsed?.proteina) return false
  const cat = getCategoriaById(parsed.categoriaId)
  if (!cat) return false
  const platillo = getPlatillosForCategoria(cat).find((p) => p.id === parsed.platilloId)
  return platillo?.tieneProteinas !== false
}

export function cartItemSupportsBebidaTamano(item: OrderItem): boolean {
  return Boolean(item.needsBebidaTamano || item.categoria === "bebidas")
}

function platilloDisplayName(categoriaId: string, platilloId: string): string {
  const cat = getCategoriaById(categoriaId)
  if (!cat) return platilloId
  const platillo = getPlatillosForCategoria(cat).find((p) => p.id === platilloId)
  return platillo?.nombre ?? cat.nombre
}

function precioConProteina(
  catalog: MenuCatalogHelpers | null,
  categoriaId: string,
  platilloId: string,
  proteina: Proteina,
): number {
  const cat = getCategoriaById(categoriaId)
  const platillo = cat
    ? getPlatillosForCategoria(cat).find((p) => p.id === platilloId)
    : undefined
  const base = platillo?.precioBase ?? cat?.precioBase ?? 0
  return (
    catalog?.getPrecioConProteina(categoriaId, proteina, platilloId) ??
    (proteina === "Camarón" ? base + 20 : base)
  )
}

function findBebidaForCart(
  catalog: MenuCatalogHelpers | null,
  bebidaId: string,
) {
  return catalog?.findBebida(bebidaId) ?? bebidas.find((b) => b.id === bebidaId)
}

function precioBebida(
  catalog: MenuCatalogHelpers | null,
  bebidaId: string,
  tamano: BebidaTamano,
): number {
  const fromCatalog = catalog?.getBebidaPrecio(bebidaId, tamano)
  if (fromCatalog != null && fromCatalog > 0) return fromCatalog
  const bebida = findBebidaForCart(catalog, bebidaId)
  if (!bebida) return 0
  return getBebidaPrecioDefault(bebida, tamano)
}

export type PortalCartItemUpdate = {
  cantidad?: number
  proteina?: Proteina
  platilloTamano?: BebidaTamano
  bebidaTamano?: BebidaTamano
  bebidaId?: string
  notas?: string
}

/** Apply quantity, protein, and/or drink size change; merges lines if the new id already exists. */
export function applyPortalCartItemUpdate(
  items: OrderItem[],
  itemId: string,
  update: PortalCartItemUpdate,
  catalog: MenuCatalogHelpers | null,
): OrderItem[] {
  const item = items.find((i) => i.id === itemId)
  if (!item) return items

  const cantidad = update.cantidad ?? item.cantidad

  if (update.notas !== undefined) {
    const notas = update.notas.trim() || undefined
    const parts = itemId.split("::")
    const newId =
      parts.length >= 3 ? `${parts[0]}::${parts[1]}::${notas ?? ""}` : itemId
    const updated: OrderItem = { ...item, id: newId, notas, cantidad }
    const withoutOld = items.filter((i) => i.id !== itemId)
    if (newId !== itemId) {
      const existing = withoutOld.find((i) => i.id === newId)
      if (existing) {
        return withoutOld
          .map((i) =>
            i.id === newId ? { ...i, cantidad: i.cantidad + cantidad } : i,
          )
          .filter((i) => i.cantidad > 0)
      }
      return [...withoutOld, updated].filter((i) => i.cantidad > 0)
    }
    return items.map((i) => (i.id === itemId ? { ...i, notas, cantidad } : i))
  }

  if (
    update.bebidaId != null &&
    (item.needsBebidaEleccion || item.categoria === "bebidas")
  ) {
    const bebida = findBebidaForCart(catalog, update.bebidaId)
    if (!bebida) return items

    const parsed = parseBebidaItemId(item.id)
    const tamPreset = item.id.includes("elige-grande")
      ? "grande"
      : item.id.includes("elige-chico")
        ? "chico"
        : null
    const tam: BebidaTamano =
      update.bebidaTamano ?? parsed?.tamano ?? tamPreset ?? "chico"

    if (item.needsBebidaTamano && !tamPreset && update.bebidaTamano == null) {
      const pendingId = `${update.bebidaId}-${PORTAL_INCOMPLETE_BEBIDA_SUFFIX}`
      const updated: OrderItem = {
        ...item,
        id: pendingId,
        bebidaId: update.bebidaId,
        needsBebidaEleccion: false,
        needsBebidaTamano: true,
        nombre: `${bebida.nombre} (elige tamaño)`,
        precio:
          catalog?.getBebidaPrecio(update.bebidaId, "chico") ??
          getBebidaPrecioDefault(bebida, "chico"),
        cantidad,
      }
      return [...items.filter((i) => i.id !== itemId), updated]
    }

    const newId = `${update.bebidaId}-${tam}`
    const updated: OrderItem = {
      ...item,
      id: newId,
      bebidaId: update.bebidaId,
      needsBebidaEleccion: false,
      needsBebidaTamano: false,
      nombre: `${bebida.nombre} (${bebidaTamanoLabels[tam]})`,
      precio: precioBebida(catalog, update.bebidaId, tam),
      cantidad,
    }

    const withoutOld = items.filter((i) => i.id !== itemId)
    const existing = withoutOld.find((i) => i.id === newId)
    if (existing) {
      return withoutOld
        .map((i) =>
          i.id === newId ? { ...i, cantidad: i.cantidad + cantidad } : i,
        )
        .filter((i) => i.cantidad > 0)
    }
    return [...withoutOld, updated].filter((i) => i.cantidad > 0)
  }

  if (
    update.bebidaTamano != null &&
    (item.needsBebidaTamano || item.categoria === "bebidas")
  ) {
    const bebidaId =
      item.bebidaId ?? parseBebidaItemId(item.id)?.bebidaId
    if (!bebidaId) {
      return items.map((i) => (i.id === itemId ? { ...i, cantidad } : i))
    }
    const bebida = findBebidaForCart(catalog, bebidaId)
    if (!bebida) return items

    const tam = update.bebidaTamano
    const newId = `${bebidaId}-${tam}`
    const updated: OrderItem = {
      ...item,
      id: newId,
      bebidaId,
      needsBebidaTamano: false,
      nombre: `${bebida.nombre} (${bebidaTamanoLabels[tam]})`,
      precio: precioBebida(catalog, bebidaId, tam),
      cantidad,
    }

    const withoutOld = items.filter((i) => i.id !== itemId)
    const existing = withoutOld.find((i) => i.id === newId)
    if (existing) {
      return withoutOld
        .map((i) =>
          i.id === newId ? { ...i, cantidad: i.cantidad + cantidad } : i,
        )
        .filter((i) => i.cantidad > 0)
    }
    return [...withoutOld, updated].filter((i) => i.cantidad > 0)
  }

  if (update.platilloTamano != null && item.needsPlatilloTamano) {
    const parsed = parseCartLineBaseId(item.id)
    if (!parsed) {
      return items.map((i) => (i.id === itemId ? { ...i, cantidad } : i))
    }
    const cat = getCategoriaById(parsed.categoriaId)
    const platillo = cat
      ? getPlatillosForCategoria(cat).find((p) => p.id === parsed.platilloId)
      : undefined
    if (!platillo || !cat) {
      return items.map((i) => (i.id === itemId ? { ...i, cantidad } : i))
    }
    const flags = platilloPickerFlags(platillo, cat)
    const tam = update.platilloTamano
    const prot = item.proteina ?? parsed.proteina
    if (flags.tieneProteinas && !prot) {
      return items.map((i) => (i.id === itemId ? { ...i, cantidad } : i))
    }
    const suffix = platilloCartSuffix(flags, tam, prot)
    const baseId = `${parsed.categoriaId}-${parsed.platilloId}-${suffix}`
    const parts = item.id.split("::")
    const newId =
      parts.length <= 1 ? baseId : `${baseId}::${parts.slice(1).join("::")}`
    const platilloNombre = platilloDisplayName(parsed.categoriaId, parsed.platilloId)
    const updated: OrderItem = {
      ...item,
      id: newId,
      proteina: prot,
      needsPlatilloTamano: false,
      needsProteina: false,
      nombre: platilloLineNombre(
        platilloNombre,
        flags,
        tam,
        prot,
        platillo,
      ),
      precio: prot
        ? (catalog?.getPrecioConProteina(
            parsed.categoriaId,
            prot,
            parsed.platilloId,
            tam,
          ) ??
          precioConProteina(catalog, parsed.categoriaId, parsed.platilloId, prot))
        : (catalog?.getPlatilloPrecioTamano(
            parsed.categoriaId,
            parsed.platilloId,
            tam,
          ) ?? platillo.precioBase),
      cantidad,
    }
    const withoutOld = items.filter((i) => i.id !== itemId)
    const existing = withoutOld.find((i) => i.id === newId)
    if (existing) {
      return withoutOld
        .map((i) =>
          i.id === newId ? { ...i, cantidad: i.cantidad + cantidad } : i,
        )
        .filter((i) => i.cantidad > 0)
    }
    return [...withoutOld, updated].filter((i) => i.cantidad > 0)
  }

  const proteinaChange =
    update.proteina != null &&
    (item.needsProteina ||
      (update.proteina !== item.proteina && cartItemSupportsProtein(item)))

  if (!proteinaChange) {
    return items
      .map((i) => (i.id === itemId ? { ...i, cantidad } : i))
      .filter((i) => i.cantidad > 0)
  }

  const parsed = parseCartLineBaseId(item.id)
  if (!parsed) {
    return items.map((i) => (i.id === itemId ? { ...i, cantidad } : i))
  }

  const newProteina = update.proteina!
  const cat = getCategoriaById(parsed.categoriaId)
  const platillo = cat
    ? getPlatillosForCategoria(cat).find((p) => p.id === parsed.platilloId)
    : undefined
  const flags =
    platillo && cat
      ? platilloPickerFlags(platillo, cat)
      : { tieneProteinas: true, tieneTamanos: false, tieneOpciones: false }
  const platilloNombre = platilloDisplayName(parsed.categoriaId, parsed.platilloId)
  const parts = item.id.split("::")

  if (item.needsPlatilloTamano) {
    const pendingId = `${parsed.categoriaId}-${parsed.platilloId}-${newProteina}-${PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX}`
    const newId =
      parts.length <= 1 ? pendingId : `${pendingId}::${parts.slice(1).join("::")}`
    const updated: OrderItem = {
      ...item,
      id: newId,
      proteina: newProteina,
      needsProteina: false,
      needsPlatilloTamano: true,
      nombre: `${platilloNombre} de ${newProteina} (elige tamaño)`,
      precio:
        catalog?.getPrecioConProteina(
          parsed.categoriaId,
          newProteina,
          parsed.platilloId,
          "chico",
        ) ?? precioConProteina(catalog, parsed.categoriaId, parsed.platilloId, newProteina),
      cantidad,
    }
    const withoutOld = items.filter((i) => i.id !== itemId)
    return [...withoutOld, updated].filter((i) => i.cantidad > 0)
  }

  let tam: BebidaTamano | undefined
  const base = parts[0] ?? item.id
  for (const t of ["chico", "grande"] as const) {
    if (base.includes(`-${t}-`) || base.endsWith(`-${t}`)) {
      tam = t
      break
    }
  }

  if (flags.tieneTamanos && !tam) {
    const pendingId = `${parsed.categoriaId}-${parsed.platilloId}-${newProteina}-${PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX}`
    const newId =
      parts.length <= 1 ? pendingId : `${pendingId}::${parts.slice(1).join("::")}`
    const updated: OrderItem = {
      ...item,
      id: newId,
      proteina: newProteina,
      needsProteina: false,
      needsPlatilloTamano: true,
      nombre: `${platilloNombre} de ${newProteina} (elige tamaño)`,
      precio:
        catalog?.getPrecioConProteina(
          parsed.categoriaId,
          newProteina,
          parsed.platilloId,
          "chico",
        ) ?? precioConProteina(catalog, parsed.categoriaId, parsed.platilloId, newProteina),
      cantidad,
    }
    const withoutOld = items.filter((i) => i.id !== itemId)
    return [...withoutOld, updated].filter((i) => i.cantidad > 0)
  }

  const suffix = flags.tieneTamanos && tam
    ? platilloCartSuffix(flags, tam, newProteina)
    : newProteina
  const baseId = `${parsed.categoriaId}-${parsed.platilloId}-${suffix}`
  const newId = parts.length <= 1 ? baseId : `${baseId}::${parts.slice(1).join("::")}`
  const updated: OrderItem = {
    ...item,
    id: newId,
    proteina: newProteina,
    needsProteina: false,
    needsPlatilloTamano: false,
    nombre:
      flags.tieneTamanos && tam
        ? platilloLineNombre(platilloNombre, flags, tam, newProteina, platillo)
        : `${platilloNombre} de ${newProteina}`,
    precio:
      flags.tieneTamanos && tam
        ? (catalog?.getPrecioConProteina(
            parsed.categoriaId,
            newProteina,
            parsed.platilloId,
            tam,
          ) ??
          precioConProteina(catalog, parsed.categoriaId, parsed.platilloId, newProteina))
        : precioConProteina(catalog, parsed.categoriaId, parsed.platilloId, newProteina),
    cantidad,
  }

  const withoutOld = items.filter((i) => i.id !== itemId)
  const existing = withoutOld.find((i) => i.id === newId)
  if (existing) {
    return withoutOld
      .map((i) =>
        i.id === newId ? { ...i, cantidad: i.cantidad + cantidad } : i,
      )
      .filter((i) => i.cantidad > 0)
  }

  return [...withoutOld, updated].filter((i) => i.cantidad > 0)
}
