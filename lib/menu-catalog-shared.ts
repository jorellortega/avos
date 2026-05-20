import {
  bebidas,
  categorias,
  getBebidaPrecioDefault,
  proteinas,
  type BebidaTamano,
  type Proteina,
} from "@/lib/menu-data"

export const MENU_CATALOG_KEY = "public_menu_catalog" as const

export type ProteinaPreciosPorCategoria = Partial<
  Record<string, Partial<Record<Proteina, number>>>
>

export type ProteinasPorCategoria = Partial<Record<string, Proteina[]>>

export type HiddenProteinasPorCategoria = ProteinasPorCategoria

export type OutProteinasPorCategoria = ProteinasPorCategoria

export type BebidaPreciosPorTamano = Partial<
  Record<string, Partial<Record<BebidaTamano, number>>>
>

export type MenuCatalogJson = {
  categoriaPrecios: Partial<Record<string, number>>
  /** Per-category, per-protein absolute prices (override base + camarón extra) */
  proteinaPreciosPorCategoria: ProteinaPreciosPorCategoria
  bebidaPrecios: BebidaPreciosPorTamano
  /** null/omit = use default 20 */
  camarónExtra: number | null
  outCategorias: string[]
  /** Out of stock on every category */
  outProteinas: string[]
  /** Out of stock only on specific categories */
  outProteinasPorCategoria: OutProteinasPorCategoria
  outBebidas: string[]
  /** Not on the public menu yet (fully hidden, not "agotado") */
  hiddenCategorias: string[]
  /** Hidden on every category */
  hiddenProteinas: string[]
  /** Hidden only on specific categories (e.g. no Camarón on Tacos) */
  hiddenProteinasPorCategoria: HiddenProteinasPorCategoria
  hiddenBebidas: string[]
}

export function defaultMenuCatalogJson(): MenuCatalogJson {
  return {
    categoriaPrecios: {},
    proteinaPreciosPorCategoria: {},
    bebidaPrecios: {},
    camarónExtra: null,
    outCategorias: [],
    outProteinas: [],
    outProteinasPorCategoria: {},
    outBebidas: [],
    hiddenCategorias: [],
    hiddenProteinas: [],
    hiddenProteinasPorCategoria: {},
    hiddenBebidas: [],
  }
}

function asNumberRecord(v: unknown): Partial<Record<string, number>> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {}
  const out: Partial<Record<string, number>> = {}
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "number" && Number.isFinite(val)) out[k] = val
  }
  return out
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string")
}

function asProteinaPreciosPorCategoria(v: unknown): ProteinaPreciosPorCategoria {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {}
  const out: ProteinaPreciosPorCategoria = {}
  for (const [catId, val] of Object.entries(v)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue
    const prot: Partial<Record<Proteina, number>> = {}
    for (const [p, price] of Object.entries(val)) {
      if (
        (proteinas as readonly string[]).includes(p) &&
        typeof price === "number" &&
        Number.isFinite(price)
      ) {
        prot[p as Proteina] = price
      }
    }
    if (Object.keys(prot).length > 0) out[catId] = prot
  }
  return out
}

function asBebidaPreciosPorTamano(v: unknown): BebidaPreciosPorTamano {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {}
  const out: BebidaPreciosPorTamano = {}
  for (const [bebidaId, val] of Object.entries(v)) {
    if (typeof val === "number" && Number.isFinite(val)) {
      out[bebidaId] = { chico: val, grande: val }
      continue
    }
    if (!val || typeof val !== "object" || Array.isArray(val)) continue
    const sizes: Partial<Record<BebidaTamano, number>> = {}
    for (const tam of ["chico", "grande"] as const) {
      const p = (val as Record<string, unknown>)[tam]
      if (typeof p === "number" && Number.isFinite(p)) sizes[tam] = p
    }
    if (Object.keys(sizes).length > 0) out[bebidaId] = sizes
  }
  return out
}

function asProteinasPorCategoria(v: unknown): ProteinasPorCategoria {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {}
  const out: ProteinasPorCategoria = {}
  for (const [catId, val] of Object.entries(v)) {
    const list = asStringArray(val).filter((p): p is Proteina =>
      (proteinas as readonly string[]).includes(p),
    )
    if (list.length > 0) out[catId] = list
  }
  return out
}

export function parseMenuCatalogJson(raw: string | null | undefined): MenuCatalogJson {
  if (!raw?.trim()) return defaultMenuCatalogJson()
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== "object" || Array.isArray(j)) return defaultMenuCatalogJson()
    const o = j as Record<string, unknown>
    const ce = o.camarónExtra
    return {
      categoriaPrecios: asNumberRecord(o.categoriaPrecios),
      proteinaPreciosPorCategoria: asProteinaPreciosPorCategoria(
        o.proteinaPreciosPorCategoria,
      ),
      bebidaPrecios: asBebidaPreciosPorTamano(o.bebidaPrecios),
      camarónExtra:
        typeof ce === "number" && Number.isFinite(ce) ? ce : ce === null ? null : null,
      outCategorias: asStringArray(o.outCategorias),
      outProteinas: asStringArray(o.outProteinas),
      outProteinasPorCategoria: asProteinasPorCategoria(o.outProteinasPorCategoria),
      outBebidas: asStringArray(o.outBebidas),
      hiddenCategorias: asStringArray(o.hiddenCategorias),
      hiddenProteinas: asStringArray(o.hiddenProteinas),
      hiddenProteinasPorCategoria: asProteinasPorCategoria(
        o.hiddenProteinasPorCategoria,
      ),
      hiddenBebidas: asStringArray(o.hiddenBebidas),
    }
  } catch {
    return defaultMenuCatalogJson()
  }
}

export function serializeMenuCatalogJson(j: MenuCatalogJson): string {
  return JSON.stringify(j)
}

export type MenuCatalogHelpers = {
  json: MenuCatalogJson
  getCategoriaPrecioBase: (categoriaId: string) => number
  getPrecioConProteina: (categoriaId: string, proteina: Proteina) => number
  getBebidaPrecio: (bebidaId: string, tamano: BebidaTamano) => number
  getCamarónExtra: () => number
  isCategoriaOut: (categoriaId: string) => boolean
  isProteinaOut: (categoriaId: string, p: Proteina | string) => boolean
  isBebidaOut: (bebidaId: string) => boolean
  isCategoriaHidden: (categoriaId: string) => boolean
  isProteinaHidden: (categoriaId: string, p: Proteina | string) => boolean
  isBebidaHidden: (bebidaId: string) => boolean
}

export function buildMenuCatalogHelpers(json: MenuCatalogJson): MenuCatalogHelpers {
  const outCat = new Set(json.outCategorias)
  const outProt = new Set(json.outProteinas)
  const outProtByCat = new Map<string, Set<string>>()
  for (const [catId, list] of Object.entries(json.outProteinasPorCategoria)) {
    if (list?.length) outProtByCat.set(catId, new Set(list))
  }
  const outBeb = new Set(json.outBebidas)
  const hiddenCat = new Set(json.hiddenCategorias)
  const hiddenProt = new Set(json.hiddenProteinas)
  const hiddenProtByCat = new Map<string, Set<string>>()
  for (const [catId, list] of Object.entries(json.hiddenProteinasPorCategoria)) {
    if (list?.length) hiddenProtByCat.set(catId, new Set(list))
  }
  const hiddenBeb = new Set(json.hiddenBebidas)

  const getCategoriaPrecioBase = (categoriaId: string) => {
    const o = json.categoriaPrecios[categoriaId]
    if (typeof o === "number" && Number.isFinite(o)) return o
    const c = categorias.find((c) => c.id === categoriaId)
    return c?.precioBase ?? 0
  }

  const getBebidaPrecio = (bebidaId: string, tamano: BebidaTamano) => {
    const o = json.bebidaPrecios[bebidaId]?.[tamano]
    if (typeof o === "number" && Number.isFinite(o)) return o
    const b = bebidas.find((b) => b.id === bebidaId)
    if (!b) return 0
    return getBebidaPrecioDefault(b, tamano)
  }

  const getCamarónExtra = () => {
    const e = json.camarónExtra
    if (typeof e === "number" && Number.isFinite(e)) return e
    return 20
  }

  const isCategoriaOut = (categoriaId: string) => outCat.has(categoriaId)

  const isProteinaOut = (categoriaId: string, p: Proteina | string) =>
    outProt.has(p) || (outProtByCat.get(categoriaId)?.has(p) ?? false)

  const isBebidaOut = (bebidaId: string) => outBeb.has(bebidaId)

  const isCategoriaHidden = (categoriaId: string) => hiddenCat.has(categoriaId)

  const isProteinaHidden = (categoriaId: string, p: Proteina | string) =>
    hiddenProt.has(p) || (hiddenProtByCat.get(categoriaId)?.has(p) ?? false)

  const isBebidaHidden = (bebidaId: string) => hiddenBeb.has(bebidaId)

  const getPrecioConProteina = (categoriaId: string, proteina: Proteina) => {
    const specific = json.proteinaPreciosPorCategoria[categoriaId]?.[proteina]
    if (typeof specific === "number" && Number.isFinite(specific)) return specific
    const base = getCategoriaPrecioBase(categoriaId)
    return precioItemConProteina(base, proteina, getCamarónExtra())
  }

  return {
    json,
    getCategoriaPrecioBase,
    getPrecioConProteina,
    getBebidaPrecio,
    getCamarónExtra,
    isCategoriaOut,
    isProteinaOut,
    isBebidaOut,
    isCategoriaHidden,
    isProteinaHidden,
    isBebidaHidden,
  }
}

export function precioItemConProteina(
  base: number,
  proteina: Proteina,
  camarónExtra: number,
): number {
  if (proteina === "Camarón") return base + camarónExtra
  return base
}
