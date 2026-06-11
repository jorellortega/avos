import type { ScheduleShiftKey } from "@/lib/schedule-types"
import {
  DEFAULT_SCHEDULE_HOURS,
  type ScheduleHoursOfOperation,
} from "@/lib/schedule-types"

export type ScheduleTimeOption = {
  value: string
  label: string
}

const STATUS_VALUES = ["Libre", "OFF", "Descanso", "Cerrado"] as const

export const STATUS_OPTIONS: ScheduleTimeOption[] = [
  { value: "", label: "—" },
  ...STATUS_VALUES.map((v) => ({ value: v, label: v })),
]

/** All 30-min slots for the hours-of-operation picker. */
export const PICKER_TIME_SLOTS = buildTimeSlots(5, 0, 23, 0)

function minutes(h: number, m: number): number {
  return h * 60 + m
}

function timeToMinutes(label: string): number | null {
  const parsed = parseHourMinute(label)
  if (!parsed) return null
  return minutes(parsed[0], parsed[1])
}

export function format12h(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mm = m === 0 ? ":00" : `:${String(m).padStart(2, "0")}`
  return `${h12}${mm} ${period}`
}

export function formatScheduleTimeRange(
  startH: number,
  startM: number,
  endH: number,
  endM: number,
): string {
  return `${format12h(startH, startM)} – ${format12h(endH, endM)}`
}

function buildTimeSlots(
  fromH: number,
  fromM: number,
  toH: number,
  toM: number,
): string[] {
  const out: string[] = []
  let cur = minutes(fromH, fromM)
  const end = minutes(toH, toM)
  while (cur <= end) {
    const h = Math.floor(cur / 60)
    const m = cur % 60
    out.push(format12h(h, m))
    cur += 30
  }
  return out
}

export function isValidScheduleHours(
  hours: ScheduleHoursOfOperation,
): boolean {
  const openM = timeToMinutes(hours.open)
  const closeM = timeToMinutes(hours.close)
  if (openM == null || closeM == null) return false
  return closeM > openM
}

export function getOperatingTimeSlots(
  hours: ScheduleHoursOfOperation = DEFAULT_SCHEDULE_HOURS,
): string[] {
  if (!isValidScheduleHours(hours)) {
    return buildTimeSlots(6, 0, 22, 0)
  }
  const open = parseHourMinute(hours.open)!
  const close = parseHourMinute(hours.close)!
  return buildTimeSlots(open[0], open[1], close[0], close[1])
}

function parseHourMinute(token: string): [number, number] | null {
  const t = token.trim().toLowerCase().replace(/\./g, "")
  if (!t) return null

  const m12 = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)$/i)
  if (m12) {
    let h = Number(m12[1])
    const min = m12[2] ? Number(m12[2]) : 0
    const ap = m12[3].toLowerCase()
    if (ap.startsWith("p") && h < 12) h += 12
    if (ap.startsWith("a") && h === 12) h = 0
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return [h, min]
    return null
  }

  const m24 = t.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (m24) {
    const h = Number(m24[1])
    const min = m24[2] ? Number(m24[2]) : 0
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return [h, min]
  }

  return null
}

export function isScheduleStatusValue(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  return STATUS_VALUES.some((s) => s.toLowerCase() === t.toLowerCase())
}

/** Map legacy free-text values to canonical AM/PM labels when possible. */
export function canonicalizeScheduleDayValue(value: string): string {
  const t = value.trim()
  if (!t) return ""
  if (isScheduleStatusValue(t)) {
    const match = STATUS_VALUES.find((s) => s.toLowerCase() === t.toLowerCase())
    return match ?? t
  }

  const parts = t.split(/\s*[-–—]\s*/)
  if (parts.length === 2) {
    const start = parseHourMinute(parts[0])
    let end = parseHourMinute(parts[1])
    if (start && end) {
      let [eh, em] = end
      if (eh < 12 && eh <= start[0]) eh += 12
      return formatScheduleTimeRange(start[0], start[1], eh, em)
    }
  }

  const single = parseHourMinute(t)
  if (single) {
    return format12h(single[0], single[1])
  }

  return t
}

export function parseScheduleDayParts(value: string): {
  entry: string
  exit: string
} {
  const canonical = canonicalizeScheduleDayValue(value)
  if (!canonical) return { entry: "", exit: "" }
  if (isScheduleStatusValue(canonical)) {
    return { entry: canonical, exit: "" }
  }

  const parts = canonical.split(/\s*–\s*/)
  if (parts.length === 2) {
    return { entry: parts[0].trim(), exit: parts[1].trim() }
  }

  return { entry: canonical, exit: "" }
}

export function composeScheduleDayValue(entry: string, exit: string): string {
  const e = entry.trim()
  const x = exit.trim()
  if (!e) return ""
  if (isScheduleStatusValue(e)) return e
  if (!x) return e
  return `${e} – ${x}`
}

export function isExitAfterEntry(entry: string, exit: string): boolean {
  const start = parseHourMinute(entry)
  const end = parseHourMinute(exit)
  if (!start || !end) return false
  return minutes(end[0], end[1]) > minutes(start[0], start[1])
}

function isTimeWithinOperatingHours(
  time: string,
  hours: ScheduleHoursOfOperation,
  mode: "entry" | "exit",
): boolean {
  const t = timeToMinutes(time)
  const openM = timeToMinutes(hours.open)
  const closeM = timeToMinutes(hours.close)
  if (t == null || openM == null || closeM == null) return false
  if (mode === "entry") return t >= openM && t < closeM
  return t > openM && t <= closeM
}

function withCustomTime(
  slots: string[],
  custom: string,
): ScheduleTimeOption[] {
  const options = slots.map((t) => ({ value: t, label: t }))
  if (
    custom &&
    !isScheduleStatusValue(custom) &&
    !slots.includes(custom)
  ) {
    return [{ value: custom, label: custom }, ...options]
  }
  return options
}

function getEntrySlots(
  _shift: ScheduleShiftKey,
  hours: ScheduleHoursOfOperation,
): string[] {
  const closeM = timeToMinutes(hours.close)
  return getOperatingTimeSlots(hours).filter((t) => {
    const tM = timeToMinutes(t)
    return tM != null && closeM != null && tM < closeM
  })
}

function getExitSlots(
  _shift: ScheduleShiftKey,
  hours: ScheduleHoursOfOperation,
  entry: string,
): string[] {
  return getOperatingTimeSlots(hours).filter(
    (t) =>
      isExitAfterEntry(entry, t) &&
      isTimeWithinOperatingHours(t, hours, "exit"),
  )
}

export function getSchedulePickerTimeOptions(
  current?: string,
): ScheduleTimeOption[] {
  const canonical = current ? canonicalizeScheduleDayValue(current) : ""
  const slots = PICKER_TIME_SLOTS
  if (canonical && !slots.includes(canonical)) {
    return [{ value: canonical, label: canonical }, ...slots.map((t) => ({ value: t, label: t }))]
  }
  return slots.map((t) => ({ value: t, label: t }))
}

export function getScheduleEntryOptions(
  shift: ScheduleShiftKey,
  hours: ScheduleHoursOfOperation,
  currentValue?: string,
): { status: ScheduleTimeOption[]; times: ScheduleTimeOption[] } {
  const { entry } = parseScheduleDayParts(currentValue ?? "")
  const slots = getEntrySlots(shift, hours)

  return {
    status: STATUS_OPTIONS,
    times: withCustomTime(slots, entry),
  }
}

export function getScheduleExitOptions(
  shift: ScheduleShiftKey,
  hours: ScheduleHoursOfOperation,
  entry: string,
  currentExit?: string,
): ScheduleTimeOption[] {
  if (!entry || isScheduleStatusValue(entry)) {
    return [{ value: "", label: "—" }]
  }

  const slots = getExitSlots(shift, hours, entry)

  return [
    { value: "", label: "—" },
    ...withCustomTime(slots, currentExit?.trim() ?? ""),
  ]
}

export function scheduleDaySelectLabel(value: string): string {
  const t = value.trim()
  if (!t) return "—"
  const { entry, exit } = parseScheduleDayParts(t)
  if (isScheduleStatusValue(entry)) return entry
  if (entry && exit) return `${entry} – ${exit}`
  if (entry) return entry
  return canonicalizeScheduleDayValue(t) || t
}
