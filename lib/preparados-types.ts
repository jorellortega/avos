export const PREP_SELECT_BLANK = "—"

export const PREP_TEMP_STATES = ["frozen", "hot", "cold"] as const

export type PrepTempState = (typeof PREP_TEMP_STATES)[number]

export interface PrepTempOption {
  id: PrepTempState
  label: string
  /** Tailwind classes for badge / card accent */
  badgeClass: string
  dotClass: string
}

export const PREP_TEMP_OPTIONS: PrepTempOption[] = [
  {
    id: "frozen",
    label: "Congelado",
    badgeClass: "bg-sky-100 text-sky-900 border-sky-200",
    dotClass: "bg-sky-500",
  },
  {
    id: "hot",
    label: "Caliente",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-200",
    dotClass: "bg-orange-500",
  },
  {
    id: "cold",
    label: "Frío",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-200",
    dotClass: "bg-blue-500",
  },
]

export const PREP_STATUS_VALUES = [
  "ready",
  "out",
  "need_more",
  "in_prep",
  "low",
] as const

export type PrepStatusValue = (typeof PREP_STATUS_VALUES)[number]

export interface PrepStatusOption {
  id: PrepStatusValue
  label: string
  value: string
  badgeClass: string
  dotClass: string
}

export const PREP_STATUS_OPTIONS: PrepStatusOption[] = [
  {
    id: "ready",
    label: "Listo",
    value: "Listo",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  {
    id: "out",
    label: "Se acabó",
    value: "Se acabó",
    badgeClass: "bg-red-100 text-red-900 border-red-200",
    dotClass: "bg-red-500",
  },
  {
    id: "need_more",
    label: "Hacer más",
    value: "Hacer más",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
    dotClass: "bg-amber-500",
  },
  {
    id: "in_prep",
    label: "En preparación",
    value: "En preparación",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-200",
    dotClass: "bg-orange-500",
  },
  {
    id: "low",
    label: "Poco queda",
    value: "Poco queda",
    badgeClass: "bg-yellow-100 text-yellow-900 border-yellow-200",
    dotClass: "bg-yellow-500",
  },
]

export const PREP_CATEGORIES = [
  "Salsas",
  "Frijoles y arroz",
  "Ensaladas",
  "Bebidas",
  "Proteínas prep",
  "Otros",
] as const

export type PrepCategory = (typeof PREP_CATEGORIES)[number]

export interface PrepReadyItemRow {
  id: string
  name: string
  temp_state: PrepTempState
  prep_status: string
  category: string
  notes: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export function normalizePrepItem(row: PrepReadyItemRow): PrepReadyItemRow {
  const temp = PREP_TEMP_STATES.includes(row.temp_state as PrepTempState)
    ? (row.temp_state as PrepTempState)
    : "cold"
  const status = normalizePrepStatusSlug(row.prep_status)
  return {
    ...row,
    name: (row.name ?? "").trim(),
    temp_state: temp,
    prep_status: status,
    category: prepCategoryLabel(row.category),
    notes: (row.notes ?? "").trim(),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order) || 0,
  }
}

export function prepCategoryLabel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim()
  return t || "Otros"
}

export function normalizePrepStatusSlug(raw: string | null | undefined): string {
  const t = (raw ?? "").trim()
  if (!t) return ""
  const byId = PREP_STATUS_OPTIONS.find((o) => o.id === t)
  if (byId) return byId.id
  const byValue = PREP_STATUS_OPTIONS.find(
    (o) => o.value.toLowerCase() === t.toLowerCase(),
  )
  return byValue?.id ?? ""
}

export function findPrepStatusOption(
  raw: string | null | undefined,
): PrepStatusOption | undefined {
  const id = normalizePrepStatusSlug(raw)
  if (!id) return undefined
  return PREP_STATUS_OPTIONS.find((o) => o.id === id)
}

export function prepStatusLabel(raw: string | null | undefined): string | null {
  return findPrepStatusOption(raw)?.label ?? null
}

export function findPrepTempOption(
  state: string | null | undefined,
): PrepTempOption | undefined {
  const id = (state ?? "").trim() as PrepTempState
  return PREP_TEMP_OPTIONS.find((o) => o.id === id)
}

export function groupPrepItemsByCategory(
  items: PrepReadyItemRow[],
): { category: string; items: PrepReadyItemRow[] }[] {
  const map = new Map<string, PrepReadyItemRow[]>()
  for (const item of items) {
    const cat = prepCategoryLabel(item.category)
    const list = map.get(cat) ?? []
    list.push(item)
    map.set(cat, list)
  }

  const result: { category: string; items: PrepReadyItemRow[] }[] = []
  for (const cat of PREP_CATEGORIES) {
    const list = map.get(cat)
    if (list?.length) result.push({ category: cat, items: list })
    map.delete(cat)
  }
  for (const cat of [...map.keys()].sort((a, b) => a.localeCompare(b, "es"))) {
    const list = map.get(cat)
    if (list?.length) result.push({ category: cat, items: list })
  }
  return result
}

export function emptyPrepItem(): Omit<
  PrepReadyItemRow,
  "id" | "created_at" | "updated_at"
> {
  return {
    name: "",
    temp_state: "cold",
    prep_status: "",
    category: "Otros",
    notes: "",
    is_active: true,
    sort_order: 0,
  }
}
