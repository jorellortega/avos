import { catalogPlatilloKey } from "@/lib/menu-catalog-shared"

export const ORDER_CUSTOMIZATIONS_KEY = "public_order_customizations" as const

export const CON_TODO_EXTRA_ID = "con-todo" as const

export type CustomizeOptionDef = {
  id: string
  label: string
}

export type PlatilloCustomizationConfig = {
  defaultLabel: string
  defaultId: string
  options: CustomizeOptionDef[]
}

export type OrderCustomizationsJson = {
  global: PlatilloCustomizationConfig
  byPlatillo: Record<string, PlatilloCustomizationConfig>
}

export function defaultPlatilloCustomizationConfig(): PlatilloCustomizationConfig {
  return {
    defaultLabel: "Con todo",
    defaultId: CON_TODO_EXTRA_ID,
    options: [
      { id: "sin-aguacate", label: "Sin aguacate" },
      { id: "sin-cebolla", label: "Sin cebolla" },
      { id: "sin-cilantro", label: "Sin cilantro" },
      { id: "sin-salsa", label: "Sin salsa" },
      { id: "sin-frijoles", label: "Sin frijoles" },
      { id: "sin-queso", label: "Sin queso" },
      { id: "sin-arroz", label: "Sin arroz" },
      { id: "extra-salsa", label: "Extra salsa" },
    ],
  }
}

export function defaultOrderCustomizationsJson(): OrderCustomizationsJson {
  return {
    global: defaultPlatilloCustomizationConfig(),
    byPlatillo: {},
  }
}

function sanitizeOption(raw: unknown): CustomizeOptionDef | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === "string" ? o.id.trim() : ""
  const label = typeof o.label === "string" ? o.label.trim() : ""
  if (!id || !label) return null
  return { id: id.slice(0, 64), label: label.slice(0, 80) }
}

function sanitizeConfig(raw: unknown): PlatilloCustomizationConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const defaultLabel =
    typeof o.defaultLabel === "string" && o.defaultLabel.trim()
      ? o.defaultLabel.trim().slice(0, 80)
      : "Con todo"
  const defaultId =
    typeof o.defaultId === "string" && o.defaultId.trim()
      ? o.defaultId.trim().slice(0, 64)
      : CON_TODO_EXTRA_ID
  const options: CustomizeOptionDef[] = []
  if (Array.isArray(o.options)) {
    for (const item of o.options) {
      const opt = sanitizeOption(item)
      if (opt && opt.id !== defaultId) options.push(opt)
    }
  }
  const seen = new Set<string>()
  const unique = options.filter((opt) => {
    if (seen.has(opt.id)) return false
    seen.add(opt.id)
    return true
  })
  return { defaultLabel, defaultId, options: unique }
}

export function parseOrderCustomizationsJson(
  raw: string | null | undefined,
): OrderCustomizationsJson {
  const fallback = defaultOrderCustomizationsJson()
  if (!raw?.trim()) return fallback
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback
    }
    const root = parsed as Record<string, unknown>
    const global =
      sanitizeConfig(root.global) ?? fallback.global
    const byPlatillo: Record<string, PlatilloCustomizationConfig> = {}
    if (root.byPlatillo && typeof root.byPlatillo === "object") {
      for (const [key, val] of Object.entries(
        root.byPlatillo as Record<string, unknown>,
      )) {
        const cfg = sanitizeConfig(val)
        if (cfg) byPlatillo[key] = cfg
      }
    }
    return { global, byPlatillo }
  } catch {
    return fallback
  }
}

export function serializeOrderCustomizationsJson(
  json: OrderCustomizationsJson,
): string {
  return JSON.stringify(json)
}

export function resolveCustomizationConfig(
  json: OrderCustomizationsJson,
  platilloKey: string,
): PlatilloCustomizationConfig {
  return json.byPlatillo[platilloKey] ?? json.global
}

export type OrderCustomizationsHelpers = {
  json: OrderCustomizationsJson
  getConfig: (categoriaId: string, platilloId?: string) => PlatilloCustomizationConfig
}

export function buildOrderCustomizationsHelpers(
  json: OrderCustomizationsJson,
): OrderCustomizationsHelpers {
  return {
    json,
    getConfig(categoriaId: string, platilloId?: string) {
      const pid = platilloId ?? categoriaId
      const key = catalogPlatilloKey(categoriaId, pid)
      return resolveCustomizationConfig(json, key)
    },
  }
}

export function defaultOrderExtras(
  config: PlatilloCustomizationConfig,
): string[] {
  return [config.defaultId]
}

export function slugifyCustomizeOptionId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
}
