const MEXICO_TZ = "America/Mexico_City"

export type ElPlanDayRow = {
  plan_date: string
  notes: string
  created_at: string
  updated_at: string
}

export type ElPlanItemRow = {
  id: string
  plan_date: string
  title: string
  item_notes: string
  completed: boolean
  completed_at: string | null
  completed_by: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export function elPlanTodayDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MEXICO_TZ }).format(
    new Date(),
  )
}

export function elPlanShiftDate(planDate: string, deltaDays: number): string {
  const [y, m, d] = planDate.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  return dt.toISOString().slice(0, 10)
}

export function elPlanFormatDateLabel(planDate: string): string {
  const [y, m, d] = planDate.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: MEXICO_TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dt)
}

export function normalizeElPlanItem(row: ElPlanItemRow): ElPlanItemRow {
  return {
    ...row,
    title: row.title.trim(),
    item_notes: row.item_notes ?? "",
    completed: Boolean(row.completed),
    sort_order: Number(row.sort_order) || 0,
  }
}

export function emptyElPlanItem(planDate: string): Omit<ElPlanItemRow, "id" | "created_at" | "updated_at" | "completed_at" | "completed_by"> {
  return {
    plan_date: planDate,
    title: "",
    item_notes: "",
    completed: false,
    sort_order: 0,
  }
}
