import {
  bebidas,
  categorias,
  type Proteina,
} from "@/lib/menu-data"

export const MENU_CATALOG_KEY = "public_menu_catalog" as const

export type MenuCatalogJson = {
  categoriaPrecios: Partial<Record<string, number>>
  bebidaPrecios: Partial<Record<string, number>>
  /** null/omit = use default 20 */
  camarónExtra: number | null
  outCategorias: string[]
  outProteinas: string[]
  outBebidas: string[]
}

export function defaultMenuCatalogJson(): MenuCatalogJson {
  return {
    categoriaPrecios: {},
    bebidaPrecios: {},
    camarónExtra: null,
    outCategorias: [],
    outProteinas: [],
    outBebidas: [],
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

export function parseMenuCatalogJson(raw: string | null | undefined): MenuCatalogJson {
  if (!raw?.trim()) return defaultMenuCatalogJson()
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== "object" || Array.isArray(j)) return defaultMenuCatalogJson()
    const o = j as Record<string, unknown>
    const ce = o.camarónExtra
    return {
      categoriaPrecios: asNumberRecord(o.categoriaPrecios),
      bebidaPrecios: asNumberRecord(o.bebidaPrecios),
      camarónExtra:
        typeof ce === "number" && Number.isFinite(ce) ? ce : ce === null ? null : null,
      outCategorias: asStringArray(o.outCategorias),
      outProteinas: asStringArray(o.outProteinas),
      outBebidas: asStringArray(o.outBebidas),
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
  getBebidaPrecio: (bebidaId: string) => number
  getCamarónExtra: () => number
  isCategoriaOut: (categoriaId: string) => boolean
  isProteinaOut: (p: Proteina | string) => boolean
  isBebidaOut: (bebidaId: string) => boolean
}

export function buildMenuCatalogHelpers(json: MenuCatalogJson): MenuCatalogHelpers {
  const outCat = new Set(json.outCategorias)
  const outProt = new Set(json.outProteinas)
  const outBeb = new Set(json.outBebidas)

  const getCategoriaPrecioBase = (categoriaId: string) => {
    const o = json.categoriaPrecios[categoriaId]
    if (typeof o === "number" && Number.isFinite(o)) return o
    const c = categorias.find((c) => c.id === categoriaId)
    return c?.precioBase ?? 0
  }

  const getBebidaPrecio = (bebidaId: string) => {
    const o = json.bebidaPrecios[bebidaId]
    if (typeof o === "number" && Number.isFinite(o)) return o
    const b = bebidas.find((b) => b.id === bebidaId)
    return b?.precio ?? 0
  }

  const getCamarónExtra = () => {
    const e = json.camarónExtra
    if (typeof e === "number" && Number.isFinite(e)) return e
    return 20
  }

  const isCategoriaOut = (categoriaId: string) => outCat.has(categoriaId)

  const isProteinaOut = (p: Proteina | string) => outProt.has(p)

  const isBebidaOut = (bebidaId: string) => outBeb.has(bebidaId)

  return {
    json,
    getCategoriaPrecioBase,
    getBebidaPrecio,
    getCamarónExtra,
    isCategoriaOut,
    isProteinaOut,
    isBebidaOut,
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
