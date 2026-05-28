import {
  bebidas,
  categorias,
  getBebidaPrecioDefault,
  getPlatillosForCategoria,
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

/** Staff-added drinks stored in the public menu catalog (not in menu-data.ts). */
export type CatalogBebida = {
  id: string
  nombre: string
  precioChico: number
  precioGrande: number
}

export type BebidaCatalogEntry = {
  id: string
  nombre: string
  precioChico: number
  precioGrande: number
  isCustom: boolean
}

export type MenuCatalogJson = {
  categoriaPrecios: Partial<Record<string, number>>
  /** Per-category, per-protein absolute prices (override base + camarón extra) */
  proteinaPreciosPorCategoria: ProteinaPreciosPorCategoria
  bebidaPrecios: BebidaPreciosPorTamano
  /** Extra drinks added in /staff/menu-catalog */
  customBebidas: CatalogBebida[]
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
  /** Whole platillo agotado (key: catalogPlatilloKey) */
  outPlatillos: string[]
  /** Whole platillo hidden from menu */
  hiddenPlatillos: string[]
}

/** Catalog scope for a menu item (category or specific platillo like california-burrito). */
export function catalogPlatilloKey(
  categoriaId: string,
  platilloId: string,
): string {
  if (platilloId === categoriaId) return categoriaId
  return `${categoriaId}:${platilloId}`
}

/** Lookup order: platillo-specific key, then legacy category key. */
export function catalogLookupKeys(
  categoriaId: string,
  platilloId?: string,
): string[] {
  if (!platilloId || platilloId === categoriaId) return [categoriaId]
  const key = catalogPlatilloKey(categoriaId, platilloId)
  return key === categoriaId ? [categoriaId] : [key, categoriaId]
}

export function slugifyBebidaId(nombre: string, taken: Set<string>): string {
  const base =
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "bebida"
  let id = base
  let n = 2
  while (taken.has(id)) {
    id = `${base}-${n}`
    n += 1
  }
  return id
}

function asCatalogBebidas(v: unknown): CatalogBebida[] {
  if (!Array.isArray(v)) return []
  const out: CatalogBebida[] = []
  const seen = new Set<string>()
  for (const row of v) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    const o = row as Record<string, unknown>
    const nombre = typeof o.nombre === "string" ? o.nombre.trim() : ""
    if (!nombre) continue
    let id =
      typeof o.id === "string" && o.id.trim()
        ? o.id.trim().toLowerCase()
        : slugifyBebidaId(nombre, seen)
    if (bebidas.some((b) => b.id === id) || seen.has(id)) {
      id = slugifyBebidaId(nombre, seen)
    }
    const precioChico =
      typeof o.precioChico === "number" && o.precioChico >= 0
        ? o.precioChico
        : 25
    const precioGrande =
      typeof o.precioGrande === "number" && o.precioGrande >= 0
        ? o.precioGrande
        : 35
    seen.add(id)
    out.push({ id, nombre, precioChico, precioGrande })
  }
  return out
}

export function getCatalogBebidas(json: MenuCatalogJson): BebidaCatalogEntry[] {
  const base: BebidaCatalogEntry[] = bebidas.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    precioChico: b.precioChico,
    precioGrande: b.precioGrande,
    isCustom: false,
  }))
  const custom: BebidaCatalogEntry[] = (json.customBebidas ?? []).map((b) => ({
    ...b,
    isCustom: true,
  }))
  return [...base, ...custom]
}

export function findBebidaInCatalog(
  bebidaId: string,
  json: MenuCatalogJson,
): BebidaCatalogEntry | undefined {
  const custom = json.customBebidas?.find((b) => b.id === bebidaId)
  if (custom) return { ...custom, isCustom: true }
  const base = bebidas.find((b) => b.id === bebidaId)
  if (base) return { ...base, isCustom: false }
  return undefined
}

export function defaultMenuCatalogJson(): MenuCatalogJson {
  return {
    categoriaPrecios: {},
    proteinaPreciosPorCategoria: {},
    bebidaPrecios: {},
    customBebidas: [],
    camarónExtra: null,
    outCategorias: [],
    outProteinas: [],
    outProteinasPorCategoria: {},
    outBebidas: [],
    hiddenCategorias: [],
    hiddenProteinas: [],
    hiddenProteinasPorCategoria: {},
    hiddenBebidas: [],
    outPlatillos: [],
    hiddenPlatillos: [],
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
      customBebidas: asCatalogBebidas(o.customBebidas),
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
      outPlatillos: asStringArray(o.outPlatillos),
      hiddenPlatillos: asStringArray(o.hiddenPlatillos),
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
  getPlatilloPrecio: (categoriaId: string, platilloId: string) => number
  getPrecioConProteina: (
    categoriaId: string,
    proteina: Proteina,
    platilloId?: string,
  ) => number
  getBebidaPrecio: (bebidaId: string, tamano: BebidaTamano) => number
  getBebidas: () => BebidaCatalogEntry[]
  findBebida: (bebidaId: string) => BebidaCatalogEntry | undefined
  getCamarónExtra: () => number
  isCategoriaOut: (categoriaId: string) => boolean
  isPlatilloOut: (categoriaId: string, platilloId: string) => boolean
  isProteinaOut: (
    categoriaId: string,
    p: Proteina | string,
    platilloId?: string,
  ) => boolean
  isBebidaOut: (bebidaId: string) => boolean
  isCategoriaHidden: (categoriaId: string) => boolean
  isPlatilloHidden: (categoriaId: string, platilloId: string) => boolean
  isProteinaHidden: (
    categoriaId: string,
    p: Proteina | string,
    platilloId?: string,
  ) => boolean
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
  const outPlat = new Set(json.outPlatillos)
  const hiddenCat = new Set(json.hiddenCategorias)
  const hiddenPlat = new Set(json.hiddenPlatillos)
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

  const getPlatilloPrecio = (categoriaId: string, platilloId: string) => {
    for (const key of catalogLookupKeys(categoriaId, platilloId)) {
      const o = json.categoriaPrecios[key]
      if (typeof o === "number" && Number.isFinite(o)) return o
    }
    const c = categorias.find((x) => x.id === categoriaId)
    if (c) {
      const p = getPlatillosForCategoria(c).find((x) => x.id === platilloId)
      if (p) return p.precioBase
    }
    return getCategoriaPrecioBase(categoriaId)
  }

  const getBebidaPrecio = (bebidaId: string, tamano: BebidaTamano) => {
    const o = json.bebidaPrecios[bebidaId]?.[tamano]
    if (typeof o === "number" && Number.isFinite(o)) return o
    const b = findBebidaInCatalog(bebidaId, json)
    if (!b) return 0
    return tamano === "chico" ? b.precioChico : b.precioGrande
  }

  const getBebidas = () => getCatalogBebidas(json)

  const findBebida = (bebidaId: string) => findBebidaInCatalog(bebidaId, json)

  const getCamarónExtra = () => {
    const e = json.camarónExtra
    if (typeof e === "number" && Number.isFinite(e)) return e
    return 20
  }

  const isCategoriaOut = (categoriaId: string) => outCat.has(categoriaId)

  const isPlatilloOut = (categoriaId: string, platilloId: string) => {
    if (isCategoriaOut(categoriaId)) return true
    for (const key of catalogLookupKeys(categoriaId, platilloId)) {
      if (outPlat.has(key)) return true
    }
    return false
  }

  const isProteinaOut = (
    categoriaId: string,
    p: Proteina | string,
    platilloId?: string,
  ) => {
    if (outProt.has(p)) return true
    for (const key of catalogLookupKeys(categoriaId, platilloId)) {
      if (outProtByCat.get(key)?.has(p)) return true
    }
    return false
  }

  const isBebidaOut = (bebidaId: string) => outBeb.has(bebidaId)

  const isCategoriaHidden = (categoriaId: string) => hiddenCat.has(categoriaId)

  const isPlatilloHidden = (categoriaId: string, platilloId: string) => {
    if (isCategoriaHidden(categoriaId)) return true
    for (const key of catalogLookupKeys(categoriaId, platilloId)) {
      if (hiddenPlat.has(key)) return true
    }
    return false
  }

  const isProteinaHidden = (
    categoriaId: string,
    p: Proteina | string,
    platilloId?: string,
  ) => {
    if (hiddenProt.has(p)) return true
    for (const key of catalogLookupKeys(categoriaId, platilloId)) {
      if (hiddenProtByCat.get(key)?.has(p)) return true
    }
    return false
  }

  const isBebidaHidden = (bebidaId: string) => hiddenBeb.has(bebidaId)

  const getPrecioConProteina = (
    categoriaId: string,
    proteina: Proteina,
    platilloId?: string,
  ) => {
    for (const key of catalogLookupKeys(categoriaId, platilloId)) {
      const specific = json.proteinaPreciosPorCategoria[key]?.[proteina]
      if (typeof specific === "number" && Number.isFinite(specific)) {
        return specific
      }
    }
    const base = getCategoriaPrecioBase(categoriaId)
    return precioItemConProteina(base, proteina, getCamarónExtra())
  }

  return {
    json,
    getCategoriaPrecioBase,
    getPlatilloPrecio,
    getPrecioConProteina,
    getBebidaPrecio,
    getBebidas,
    findBebida,
    getCamarónExtra,
    isCategoriaOut,
    isPlatilloOut,
    isProteinaOut,
    isBebidaOut,
    isCategoriaHidden,
    isPlatilloHidden,
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
