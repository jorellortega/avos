import {
  CON_TODO_EXTRA_ID,
  defaultOrderExtras,
  defaultPlatilloCustomizationConfig,
  type CustomizeOptionDef,
  type PlatilloCustomizationConfig,
} from "@/lib/order-item-customizations"

export { CON_TODO_EXTRA_ID } from "@/lib/order-item-customizations"

/** @deprecated Use config from `public_order_customizations`; kept for imports. */
export const ORDER_ITEM_EXTRA_OPTIONS = [
  { id: CON_TODO_EXTRA_ID, label: "Con todo" },
  ...defaultPlatilloCustomizationConfig().options,
] as const

export type OrderExtraId = string

export const DEFAULT_ORDER_EXTRAS: string[] = [CON_TODO_EXTRA_ID]

export function toggleOrderExtra(
  extras: string[],
  id: string,
  config: PlatilloCustomizationConfig = defaultPlatilloCustomizationConfig(),
): string[] {
  const defaultId = config.defaultId
  if (id === defaultId) {
    return extras.includes(defaultId) ? [] : [defaultId]
  }

  let next = extras.filter((e) => e !== defaultId)
  if (next.includes(id)) {
    next = next.filter((e) => e !== id)
  } else {
    next = [...next, id]
  }
  return next
}

export function formatOrderItemNotas(
  extras: string[],
  customNote?: string,
  config: PlatilloCustomizationConfig = defaultPlatilloCustomizationConfig(),
): string | undefined {
  const custom = customNote?.trim()
  const defaultId = config.defaultId
  const effective =
    extras.length === 0 && !custom ? [defaultId] : extras
  const labels = effective.map((id) => labelForExtraId(id, config))
  if (custom) labels.push(custom)
  return labels.length > 0 ? labels.join(", ") : undefined
}

function labelForExtraId(
  id: string,
  config: PlatilloCustomizationConfig,
): string {
  if (id === config.defaultId) return config.defaultLabel
  return config.options.find((o) => o.id === id)?.label ?? id
}

export function cartLineKey(
  baseId: string,
  extras: string[],
  customNote?: string,
  config: PlatilloCustomizationConfig = defaultPlatilloCustomizationConfig(),
): string {
  const custom = (customNote ?? "").trim()
  const defaultId = config.defaultId
  const normalized =
    extras.length === 0 && !custom ? [defaultId] : extras
  const sorted = [...normalized].sort().join(",")
  return `${baseId}::${sorted}::${custom}`
}

export function parseCartLineCustomization(
  itemId: string,
  config: PlatilloCustomizationConfig = defaultPlatilloCustomizationConfig(),
): { baseId: string; extras: string[]; customNote: string } {
  const parts = itemId.split("::")
  const baseId = parts[0]
  if (parts.length < 3) {
    return {
      baseId,
      extras: defaultOrderExtras(config),
      customNote: "",
    }
  }
  const extrasRaw = parts[1]
  const customNote = parts.slice(2).join("::")
  const extras = extrasRaw
    ? extrasRaw.split(",").filter(Boolean)
    : defaultOrderExtras(config)
  return { baseId, extras, customNote }
}

export type { CustomizeOptionDef, PlatilloCustomizationConfig }
