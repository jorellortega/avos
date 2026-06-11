import type {
  ScheduleDayKey,
  StaffScheduleEmployeeRow,
} from "@/lib/schedule-types"
import { SCHEDULE_DAY_KEYS } from "@/lib/schedule-types"

const OFF_DAY_RE =
  /^(off|libre|descanso|cerrado|na|n\/a|—|-|–|x)$/i

export function isScheduleDayWorked(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  return !OFF_DAY_RE.test(t)
}

export function countEmployeeScheduledDays(
  employee: StaffScheduleEmployeeRow,
): number {
  return SCHEDULE_DAY_KEYS.filter((day) =>
    isScheduleDayWorked(employee[day]),
  ).length
}

export function employeeWeeklyPay(employee: StaffScheduleEmployeeRow): number {
  const rate = Number(employee.daily_pay ?? 0)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return rate * countEmployeeScheduledDays(employee)
}

export type SchedulePaySummary = {
  dailyByDay: Record<ScheduleDayKey, number>
  weeklyTotal: number
  monthlyEstimate: number
  perEmployee: Array<{
    id: string
    name: string
    dailyPay: number
    scheduledDays: number
    weeklyPay: number
  }>
}

export function computeSchedulePaySummary(
  employees: StaffScheduleEmployeeRow[],
): SchedulePaySummary {
  const dailyByDay = Object.fromEntries(
    SCHEDULE_DAY_KEYS.map((day) => [day, 0]),
  ) as Record<ScheduleDayKey, number>

  const perEmployee: SchedulePaySummary["perEmployee"] = []

  for (const emp of employees) {
    const dailyPay = Number(emp.daily_pay ?? 0)
    if (!Number.isFinite(dailyPay) || dailyPay <= 0) continue

    let scheduledDays = 0
    for (const day of SCHEDULE_DAY_KEYS) {
      if (!isScheduleDayWorked(emp[day])) continue
      scheduledDays += 1
      dailyByDay[day] += dailyPay
    }

    if (scheduledDays === 0) continue

    perEmployee.push({
      id: emp.id,
      name: emp.name.trim() || "Sin nombre",
      dailyPay,
      scheduledDays,
      weeklyPay: dailyPay * scheduledDays,
    })
  }

  const weeklyTotal = perEmployee.reduce((sum, row) => sum + row.weeklyPay, 0)
  const monthlyEstimate = weeklyTotal * (52 / 12)

  return { dailyByDay, weeklyTotal, monthlyEstimate, perEmployee }
}

export function formatScheduleMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}
