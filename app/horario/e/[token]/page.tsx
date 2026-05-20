import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createServerSupabase } from "@/lib/supabase/server"
import type {
  ScheduleDayKey,
  ScheduleShiftKey,
  StaffScheduleEmployeePublic,
} from "@/lib/schedule-types"
import {
  SCHEDULE_DAY_KEYS,
  SCHEDULE_DAY_LABELS,
  SCHEDULE_SHIFT_LABELS,
} from "@/lib/schedule-types"

export const metadata: Metadata = {
  title: "Mi horario | Avos",
  description: "Horario semanal de trabajo.",
  robots: { index: false, follow: false },
}

function parsePublicSnapshot(raw: unknown): StaffScheduleEmployeePublic | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const daysRaw = o.days
  if (!daysRaw || typeof daysRaw !== "object") return null
  const daysObj = daysRaw as Record<string, unknown>

  const shiftRaw = String(o.shift ?? "manana")
  const shift: ScheduleShiftKey =
    shiftRaw === "tarde" ? "tarde" : "manana"

  const days = {} as Record<ScheduleDayKey, string>
  for (const day of SCHEDULE_DAY_KEYS) {
    const v = daysObj[day]
    if (v && typeof v === "object" && "manana" in (v as object)) {
      const nested = v as Record<string, unknown>
      days[day] = String(nested[shift] ?? "")
    } else {
      days[day] = String(v ?? "")
    }
  }

  return {
    name: String(o.name ?? ""),
    shift,
    title: String(o.title ?? "Horario"),
    week_start: o.week_start != null ? String(o.week_start) : null,
    days,
  }
}

function formatWeekStart(iso: string | null) {
  if (!iso) return null
  try {
    const [y, m, d] = iso.split("-").map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

function formatShift(value: string) {
  const t = value.trim()
  return t || "—"
}

export default async function EmployeeSchedulePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc(
    "get_staff_schedule_employee_public",
    { p_token: token },
  )

  if (error) {
    console.error("get_staff_schedule_employee_public", error.message)
    notFound()
  }

  const schedule = parsePublicSnapshot(data)
  if (!schedule || !schedule.name.trim()) {
    notFound()
  }

  const weekLabel = formatWeekStart(schedule.week_start)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-10 md:py-14">
        <div className="container mx-auto px-4 max-w-lg space-y-6">
          <header className="text-center space-y-1">
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {schedule.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {schedule.title}
              {weekLabel ? (
                <>
                  {" · "}
                  <span className="capitalize">{weekLabel}</span>
                </>
              ) : null}
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Turno de {SCHEDULE_SHIFT_LABELS[schedule.shift].toLowerCase()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-lg border">
                {SCHEDULE_DAY_KEYS.map((day) => (
                  <li
                    key={day}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <span className="font-medium text-foreground w-12">
                      {SCHEDULE_DAY_LABELS[day]}
                    </span>
                    <span className="text-muted-foreground text-right">
                      {formatShift(schedule.days[day])}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="underline underline-offset-2">
              Avos
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
