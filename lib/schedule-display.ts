import type {
  ScheduleDayKey,
  ScheduleShiftKey,
  StaffScheduleEmployeeRow,
  StaffScheduleRow,
} from "@/lib/schedule-types"
import {
  SCHEDULE_DAY_KEYS,
  SCHEDULE_DAY_LABELS,
  SCHEDULE_SHIFT_KEYS,
  SCHEDULE_SHIFT_LABELS,
} from "@/lib/schedule-types"

export type ScheduleDayDateLabel = {
  day: ScheduleDayKey
  shortLabel: string
  dateLine: string | null
  columnHeader: string
}

function parseWeekStart(weekStart: string): Date | null {
  const [y, m, d] = weekStart.split("-").map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatScheduleWeekRange(weekStart: string | null): string | null {
  if (!weekStart) return null
  const start = parseWeekStart(weekStart)
  if (!start) return weekStart

  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const fmt = (d: Date) =>
    d.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: start.getFullYear() !== end.getFullYear() ? "numeric" : undefined,
    })

  const endFmt = end.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} – ${end.getDate()} de ${end.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}`
  }

  return `${fmt(start)} – ${endFmt}`
}

export function getScheduleDayDateLabels(
  weekStart: string | null,
): ScheduleDayDateLabel[] {
  const start = weekStart ? parseWeekStart(weekStart) : null

  return SCHEDULE_DAY_KEYS.map((day, index) => {
    let dateLine: string | null = null
    if (start) {
      const d = new Date(start)
      d.setDate(d.getDate() + index)
      dateLine = d.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
      })
    }

    const shortLabel = SCHEDULE_DAY_LABELS[day]
    const columnHeader = dateLine ? `${shortLabel}\n${dateLine}` : shortLabel

    return { day, shortLabel, dateLine, columnHeader }
  })
}

export function formatScheduleCell(value: string): string {
  const t = value.trim()
  return t || "—"
}

export function buildFullSchedulePlainText(
  schedule: StaffScheduleRow,
  employees: StaffScheduleEmployeeRow[],
): string {
  const lines: string[] = [schedule.title.trim() || "Horario"]
  const range = formatScheduleWeekRange(schedule.week_start)
  if (range) lines.push(range)

  const dayLabels = getScheduleDayDateLabels(schedule.week_start)

  for (const shift of SCHEDULE_SHIFT_KEYS) {
    const shiftRows = employees.filter(
      (e) => (e.shift ?? "manana") === shift && e.name.trim(),
    )
    if (shiftRows.length === 0) continue

    lines.push("")
    lines.push(`=== ${SCHEDULE_SHIFT_LABELS[shift]} ===`)

    for (const emp of shiftRows) {
      lines.push("")
      lines.push(emp.name.trim())
      for (const { day, shortLabel, dateLine } of dayLabels) {
        const when = dateLine ? `${shortLabel} ${dateLine}` : shortLabel
        lines.push(`  ${when}: ${formatScheduleCell(emp[day])}`)
      }
    }
  }

  const unnamed = employees.filter((e) => !e.name.trim())
  if (unnamed.length > 0) {
    lines.push("")
    lines.push(`(${unnamed.length} fila(s) sin nombre omitidas)`)
  }

  return lines.join("\n")
}
