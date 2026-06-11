export type ScheduleHoursOfOperation = {
  open: string
  close: string
}

export const DEFAULT_SCHEDULE_HOURS: ScheduleHoursOfOperation = {
  open: "8:00 AM",
  close: "10:00 PM",
}

export interface StaffScheduleRow {
  id: string
  title: string
  week_start: string | null
  hours_open: string
  hours_close: string
  is_published: boolean
  created_at: string
  updated_at: string
}

export function resolveScheduleHours(
  schedule: Pick<StaffScheduleRow, "hours_open" | "hours_close">,
): ScheduleHoursOfOperation {
  const open = schedule.hours_open?.trim() || DEFAULT_SCHEDULE_HOURS.open
  const close = schedule.hours_close?.trim() || DEFAULT_SCHEDULE_HOURS.close
  return { open, close }
}

export type ScheduleDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export type ScheduleShiftKey = "manana" | "tarde"

export interface StaffScheduleEmployeeRow {
  id: string
  schedule_id: string
  name: string
  share_token: string
  shift: ScheduleShiftKey
  /** MXN per scheduled work day (manager view only). */
  daily_pay: number | null
  mon: string
  tue: string
  wed: string
  thu: string
  fri: string
  sat: string
  sun: string
  sort_order: number
  created_at: string
  updated_at: string
}

export const SCHEDULE_DAY_KEYS: ScheduleDayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]

export const SCHEDULE_SHIFT_KEYS: ScheduleShiftKey[] = ["manana", "tarde"]

export const SCHEDULE_DAY_LABELS: Record<ScheduleDayKey, string> = {
  mon: "Lun",
  tue: "Mar",
  wed: "Mié",
  thu: "Jue",
  fri: "Vie",
  sat: "Sáb",
  sun: "Dom",
}

export const SCHEDULE_SHIFT_LABELS: Record<ScheduleShiftKey, string> = {
  manana: "Mañana",
  tarde: "Tarde",
}

export interface StaffScheduleEmployeePublic {
  name: string
  shift: ScheduleShiftKey
  title: string
  week_start: string | null
  days: Record<ScheduleDayKey, string>
}
