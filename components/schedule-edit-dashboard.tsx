"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type {
  StaffScheduleEmployeeRow,
  StaffScheduleRow,
  ScheduleShiftKey,
} from "@/lib/schedule-types"
import {
  DEFAULT_SCHEDULE_HOURS,
  resolveScheduleHours,
} from "@/lib/schedule-types"
import {
  SCHEDULE_DAY_KEYS,
  SCHEDULE_DAY_LABELS,
  SCHEDULE_SHIFT_KEYS,
  SCHEDULE_SHIFT_LABELS,
} from "@/lib/schedule-types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Brain, Copy, Link2, Plus, Trash2 } from "lucide-react"
import { ScheduleDaySelect } from "@/components/schedule-day-select"
import { ScheduleHoursSelect } from "@/components/schedule-hours-select"
import { isValidScheduleHours } from "@/lib/schedule-time-options"
import { ScheduleAiAssistant } from "@/components/schedule-ai-assistant"
import { ScheduleRowAiDialog } from "@/components/schedule-row-ai-dialog"
import { ScheduleFullViewDialog } from "@/components/schedule-full-view-dialog"
import {
  findDuplicateEmployeeIds,
  findEmployeesByNameAndShift,
  findScheduleEmployee,
  pickBestScheduleEmployee,
  resolveUpdateShift,
  type ScheduleAiResult,
} from "@/lib/schedule-ai"
import {
  computeSchedulePaySummary,
  employeeWeeklyPay,
  formatScheduleMoney,
} from "@/lib/schedule-pay"

function employeeSharePath(token: string) {
  return `/horario/e/${token}`
}

function employeeFieldKey(id: string, field: string) {
  return `${id}:${field}`
}

export function ScheduleEditDashboard() {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [schedule, setSchedule] = useState<StaffScheduleRow | null>(null)
  const [employees, setEmployees] = useState<StaffScheduleEmployeeRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [savedHeader, setSavedHeader] = useState(false)
  const [rowAiEmployeeId, setRowAiEmployeeId] = useState<string | null>(null)
  /** Values when a field gained focus — compared on blur so we don't skip save after onChange updated local state. */
  const fieldFocusRef = useRef<Record<string, string>>({})

  const ensureSchedule = useCallback(async (): Promise<StaffScheduleRow | null> => {
    const { data: existing, error: listErr } = await supabase
      .from("staff_schedules")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (listErr) {
      setLoadError(listErr.message)
      return null
    }

    if (existing) {
      return existing as StaffScheduleRow
    }

    const { data: created, error: insertErr } = await supabase
      .from("staff_schedules")
      .insert({ title: "Horario de la semana" })
      .select("*")
      .single()

    if (insertErr) {
      setLoadError(insertErr.message)
      return null
    }

    return created as StaffScheduleRow
  }, [supabase])

  const refreshEmployees = useCallback(
    async (scheduleId: string) => {
      const { data, error } = await supabase
        .from("staff_schedule_employees")
        .select("*")
        .eq("schedule_id", scheduleId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })

      if (error) {
        setLoadError(error.message)
        return
      }
      setEmployees((data ?? []) as StaffScheduleEmployeeRow[])
    },
    [supabase],
  )

  const refreshAll = useCallback(async () => {
    setLoadError(null)
    const sched = await ensureSchedule()
    if (!sched) return
    setSchedule(sched)
    await refreshEmployees(sched.id)
  }, [ensureSchedule, refreshEmployees])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  async function saveScheduleHeader(patch: Partial<StaffScheduleRow>) {
    if (!schedule) return
    setLoadError(null)
    setSavedHeader(false)
    const { data, error } = await supabase
      .from("staff_schedules")
      .update(patch)
      .eq("id", schedule.id)
      .select("*")
      .single()

    if (error) {
      setLoadError(error.message)
      return
    }
    setSchedule(data as StaffScheduleRow)
    setSavedHeader(true)
    window.setTimeout(() => setSavedHeader(false), 1500)
  }

  async function addEmployee(
    shift: ScheduleShiftKey,
    initial?: Partial<StaffScheduleEmployeeRow>,
  ): Promise<StaffScheduleEmployeeRow | null> {
    if (!schedule) return null
    setBusyId(`new-${shift}`)

    let sortOrder = 0
    setEmployees((prev) => {
      const inShift = prev.filter((e) => e.shift === shift)
      sortOrder =
        inShift.length > 0 ? Math.max(...inShift.map((e) => e.sort_order)) + 1 : 0
      return prev
    })

    const dayPatch = initial
      ? Object.fromEntries(
          SCHEDULE_DAY_KEYS.filter((d) => initial[d] !== undefined).map((d) => [
            d,
            initial[d],
          ]),
        )
      : {}

    const { data, error } = await supabase
      .from("staff_schedule_employees")
      .insert({
        schedule_id: schedule.id,
        name: initial?.name ?? "",
        shift,
        sort_order: sortOrder,
        ...dayPatch,
      })
      .select("*")
      .single()

    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return null
    }
    const row = data as StaffScheduleEmployeeRow
    setEmployees((prev) => [...prev, row])
    return row
  }

  async function updateEmployee(
    id: string,
    patch: Partial<StaffScheduleEmployeeRow>,
  ) {
    setLoadError(null)
    const { error } = await supabase
      .from("staff_schedule_employees")
      .update(patch)
      .eq("id", id)

    if (error) {
      setLoadError(error.message)
      return
    }

    setEmployees((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }

  async function deleteEmployee(id: string) {
    setBusyId(id)
    const { error } = await supabase
      .from("staff_schedule_employees")
      .delete()
      .eq("id", id)
    setBusyId(null)

    if (error) {
      setLoadError(error.message)
      return
    }
    setEmployees((prev) => prev.filter((row) => row.id !== id))
  }

  async function copyShareLink(emp: StaffScheduleEmployeeRow) {
    const path = employeeSharePath(emp.share_token)
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${path}`
        : path

    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(emp.id)
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setLoadError("No se pudo copiar el enlace. Copia manualmente: " + url)
    }
  }

  function updateLocalEmployee(
    id: string,
    field: keyof StaffScheduleEmployeeRow,
    value: string | number | null,
  ) {
    setEmployees((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    )
  }

  function parseDailyPayInput(raw: string): number | null {
    const t = raw.trim()
    if (!t) return null
    const n = Number(t.replace(/,/g, ""))
    if (!Number.isFinite(n) || n < 0) return null
    return n
  }

  async function dedupeNamedEmployees(
    roster: StaffScheduleEmployeeRow[],
  ): Promise<StaffScheduleEmployeeRow[]> {
    let next = roster
    for (const { removeIds } of findDuplicateEmployeeIds(next)) {
      for (const id of removeIds) {
        await deleteEmployee(id)
        next = next.filter((row) => row.id !== id)
      }
    }
    return next
  }

  async function applyScheduleAiRowPlan(
    employee: StaffScheduleEmployeeRow,
    plan: ScheduleAiResult,
  ): Promise<string | null> {
    const update = plan.employee_updates?.[0]
    if (!update) return null

    const patch: Partial<StaffScheduleEmployeeRow> = {}
    const resolvedName =
      update.name?.trim() || update.match.name?.trim() || ""
    if (resolvedName) patch.name = resolvedName
    if (update.days) Object.assign(patch, update.days)

    if (Object.keys(patch).length === 0) return null

    await updateEmployee(employee.id, patch)
    return null
  }

  const rowAiEmployee =
    rowAiEmployeeId != null
      ? employees.find((e) => e.id === rowAiEmployeeId) ?? null
      : null

  const paySummary = useMemo(
    () => computeSchedulePaySummary(employees),
    [employees],
  )

  const operatingHours = useMemo(() => {
    if (!schedule) return DEFAULT_SCHEDULE_HOURS
    return resolveScheduleHours(schedule)
  }, [schedule])

  const hoursInvalid = !isValidScheduleHours(operatingHours)

  async function applyScheduleAiPlan(
    plan: ScheduleAiResult,
  ): Promise<string | null> {
    if (!schedule) return "Horario no cargado."
    const warnings: string[] = []
    let roster = await dedupeNamedEmployees(employees)

    if (plan.schedule) {
      const headerPatch: Partial<StaffScheduleRow> = {}
      if (plan.schedule.title) headerPatch.title = plan.schedule.title
      if (plan.schedule.week_start !== undefined) {
        headerPatch.week_start = plan.schedule.week_start
      }
      if (Object.keys(headerPatch).length > 0) {
        await saveScheduleHeader(headerPatch)
      }
    }

    if (plan.employee_updates_all?.days) {
      for (const emp of roster) {
        await updateEmployee(emp.id, plan.employee_updates_all.days)
      }
      roster = roster.map((emp) => ({
        ...emp,
        ...plan.employee_updates_all!.days,
      }))
    }

    for (const update of plan.employee_updates ?? []) {
      const shift = resolveUpdateShift(update, roster)
      const emp = findScheduleEmployee(roster, update.match, shift)
      if (!emp) {
        const label =
          update.match.name ?? update.match.id ?? "empleado desconocido"
        warnings.push(`No encontré a «${label}».`)
        continue
      }
      const patch: Partial<StaffScheduleEmployeeRow> = {}
      const resolvedName =
        update.name?.trim() || update.match.name?.trim() || ""
      if (resolvedName && resolvedName !== emp.name.trim()) {
        patch.name = resolvedName
      }
      if (update.days) Object.assign(patch, update.days)
      if (Object.keys(patch).length > 0) {
        await updateEmployee(emp.id, patch)
        roster = roster.map((row) =>
          row.id === emp.id ? { ...row, ...patch } : row,
        )
      }
    }

    roster = await dedupeNamedEmployees(roster)

    for (const add of plan.add_employees ?? []) {
      const shift = add.shift ?? "manana"
      const existing = pickBestScheduleEmployee(
        findEmployeesByNameAndShift(roster, add.name, shift),
      )
      if (existing) {
        const patch: Partial<StaffScheduleEmployeeRow> = {
          name: add.name.trim(),
          ...(add.days ?? {}),
        }
        await updateEmployee(existing.id, patch)
        roster = roster.map((row) =>
          row.id === existing.id ? { ...row, ...patch } : row,
        )
        continue
      }

      const row = await addEmployee(shift, {
        name: add.name,
        ...add.days,
      })
      if (!row) {
        warnings.push(`No se pudo agregar a «${add.name}».`)
      } else {
        roster = [...roster, row]
      }
    }

    roster = await dedupeNamedEmployees(roster)

    for (const remove of plan.remove ?? []) {
      const emp = findScheduleEmployee(roster, remove)
      if (!emp) {
        const label = remove.name ?? remove.id ?? "empleado"
        warnings.push(`No encontré a «${label}» para quitar.`)
        continue
      }
      await deleteEmployee(emp.id)
      roster = roster.filter((row) => row.id !== emp.id)
    }

    const hasEdits =
      plan.schedule ||
      plan.employee_updates?.length ||
      plan.employee_updates_all?.days ||
      plan.add_employees?.length ||
      plan.remove?.length

    if (!hasEdits) {
      return null
    }

    return warnings.length > 0 ? warnings.join(" ") : null
  }

  if (!schedule) {
    return <p className="text-sm text-muted-foreground">Cargando horario…</p>
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Semana</CardTitle>
            <CardDescription>
              Pon el título y publica cuando esté listo. Cada empleado tendrá su
              propio enlace para ver solo su horario.
            </CardDescription>
          </div>
          <ScheduleFullViewDialog schedule={schedule} employees={employees} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-title">Título</Label>
              <Input
                id="schedule-title"
                value={schedule.title}
                onChange={(e) =>
                  setSchedule({ ...schedule, title: e.target.value })
                }
                onBlur={() => {
                  if (schedule.title.trim()) {
                    void saveScheduleHeader({ title: schedule.title.trim() })
                  }
                }}
                placeholder="Ej. Semana del 19 al 25 de mayo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="week-start">Inicio de semana (opcional)</Label>
              <Input
                id="week-start"
                type="date"
                value={schedule.week_start ?? ""}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    week_start: e.target.value || null,
                  })
                }
                onBlur={() =>
                  void saveScheduleHeader({
                    week_start: schedule.week_start || null,
                  })
                }
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium">Horario de operación</p>
              <p className="text-xs text-muted-foreground mt-1">
                Los turnos de empleados solo pueden elegir horas entre apertura
                y cierre.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ScheduleHoursSelect
                label="Apertura"
                value={operatingHours.open}
                onChange={(open) => {
                  setSchedule({ ...schedule, hours_open: open })
                  void saveScheduleHeader({ hours_open: open })
                }}
              />
              <ScheduleHoursSelect
                label="Cierre"
                value={operatingHours.close}
                onChange={(close) => {
                  setSchedule({ ...schedule, hours_close: close })
                  void saveScheduleHeader({ hours_close: close })
                }}
              />
            </div>
            {hoursInvalid && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                El cierre debe ser después de la apertura.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id="schedule-published"
              checked={schedule.is_published}
              onCheckedChange={(checked) => {
                setSchedule({ ...schedule, is_published: checked })
                void saveScheduleHeader({ is_published: checked })
              }}
            />
            <Label htmlFor="schedule-published" className="cursor-pointer">
              Publicado (los enlaces funcionan para empleados)
            </Label>
            {savedHeader && (
              <span className="text-xs text-muted-foreground">Guardado</span>
            )}
          </div>

          {!schedule.is_published && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Mientras no esté publicado, los enlaces de empleados mostrarán que
              el horario no está disponible.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Costo de nómina</CardTitle>
          <CardDescription>
            Pon el pago por día de cada empleado (MXN). Se calcula según los
            días con horario (vacío, Libre u OFF no cuentan).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paySummary.perEmployee.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Agrega pago por día en las filas de abajo para ver totales.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Esta semana
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatScheduleMoney(paySummary.weeklyTotal)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Promedio mensual
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatScheduleMoney(paySummary.monthlyEstimate)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimado (52 semanas ÷ 12 meses)
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Empleados con pago
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {paySummary.perEmployee.length}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Costo por día</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {SCHEDULE_DAY_KEYS.map((day) => (
                    <div
                      key={day}
                      className="rounded-md border px-3 py-2 text-center"
                    >
                      <p className="text-xs text-muted-foreground">
                        {SCHEDULE_DAY_LABELS[day]}
                      </p>
                      <p className="text-sm font-medium tabular-nums">
                        {paySummary.dailyByDay[day] > 0
                          ? formatScheduleMoney(paySummary.dailyByDay[day])
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ScheduleAiAssistant
        schedule={schedule}
        employees={employees}
        onApply={applyScheduleAiPlan}
      />

      {SCHEDULE_SHIFT_KEYS.map((shift) => {
        const shiftEmployees = employees.filter(
          (e) => (e.shift ?? "manana") === shift,
        )
        return (
          <Card key={shift}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>
                  Turno de {SCHEDULE_SHIFT_LABELS[shift].toLowerCase()}
                </CardTitle>
                <CardDescription>
                  Lista separada para este turno. Cada persona tiene su propio
                  enlace (solo ve este turno).
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void addEmployee(shift)}
                disabled={busyId === `new-${shift}`}
              >
                <Plus className="size-4 mr-1" />
                Agregar nombre
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px] sticky left-0 bg-card z-10">
                      Nombre
                    </TableHead>
                    <TableHead className="min-w-[100px] text-right">
                      Pago/día
                    </TableHead>
                    {SCHEDULE_DAY_KEYS.map((day) => (
                      <TableHead
                        key={day}
                        className="min-w-[8.5rem] text-center"
                      >
                        {SCHEDULE_DAY_LABELS[day]}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[90px] text-right">
                      Semana
                    </TableHead>
                    <TableHead className="min-w-[120px] text-right">
                      Enlace
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={
                          SCHEDULE_DAY_KEYS.length + 4
                        }
                        className="text-center text-muted-foreground py-8"
                      >
{"Agrega el primer nombre con el botón de arriba."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    shiftEmployees.map((emp) => (
                      <TableRow key={`${shift}-${emp.id}`}>
                        <TableCell className="sticky left-0 bg-card z-10 p-2">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-8 shrink-0"
                              title="IA para esta fila"
                              onClick={() => setRowAiEmployeeId(emp.id)}
                            >
                              <Brain className="size-4 text-primary" />
                            </Button>
                            <Input
                              value={emp.name}
                              onFocus={() => {
                                fieldFocusRef.current[
                                  employeeFieldKey(emp.id, "name")
                                ] = emp.name
                              }}
                              onChange={(e) =>
                                updateLocalEmployee(
                                  emp.id,
                                  "name",
                                  e.target.value,
                                )
                              }
                              onBlur={(e) => {
                                const name = e.target.value.trim()
                                const key = employeeFieldKey(emp.id, "name")
                                const atFocus =
                                  fieldFocusRef.current[key] ?? emp.name
                                delete fieldFocusRef.current[key]
                                if (name !== atFocus.trim()) {
                                  void updateEmployee(emp.id, { name })
                                }
                              }}
                              placeholder="Nombre"
                              className="min-w-[100px] flex-1"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={
                              emp.daily_pay != null ? String(emp.daily_pay) : ""
                            }
                            onFocus={() => {
                              fieldFocusRef.current[
                                employeeFieldKey(emp.id, "daily_pay")
                              ] =
                                emp.daily_pay != null
                                  ? String(emp.daily_pay)
                                  : ""
                            }}
                            onChange={(e) => {
                              const parsed = parseDailyPayInput(e.target.value)
                              updateLocalEmployee(emp.id, "daily_pay", parsed)
                            }}
                            onBlur={(e) => {
                              const key = employeeFieldKey(emp.id, "daily_pay")
                              const atFocus = fieldFocusRef.current[key] ?? ""
                              delete fieldFocusRef.current[key]
                              const parsed = parseDailyPayInput(e.target.value)
                              const prevParsed = parseDailyPayInput(atFocus)
                              const same =
                                parsed === prevParsed ||
                                (parsed != null &&
                                  prevParsed != null &&
                                  parsed === prevParsed)
                              if (!same) {
                                void updateEmployee(emp.id, {
                                  daily_pay: parsed,
                                })
                              }
                            }}
                            placeholder="MXN"
                            className="text-right text-sm min-w-[88px]"
                          />
                        </TableCell>
                        {SCHEDULE_DAY_KEYS.map((day) => (
                          <TableCell key={day} className="p-1">
                            <ScheduleDaySelect
                              shift={shift}
                              hours={operatingHours}
                              value={emp[day]}
                              onChange={(next) => {
                                if (next === emp[day]) return
                                updateLocalEmployee(emp.id, day, next)
                                void updateEmployee(emp.id, { [day]: next })
                              }}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="p-2 text-right text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                          {employeeWeeklyPay(emp) > 0
                            ? formatScheduleMoney(employeeWeeklyPay(emp))
                            : "—"}
                        </TableCell>
                        <TableCell className="p-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8"
                                title="Copiar enlace para este empleado"
                                onClick={() => void copyShareLink(emp)}
                                disabled={!emp.name.trim()}
                              >
                                {copiedId === emp.id ? (
                                  <Copy className="size-4 text-green-600" />
                                ) : (
                                  <Link2 className="size-4" />
                                )}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-destructive"
                                    disabled={busyId === emp.id}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      ¿Quitar a {emp.name || "este empleado"}?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se borrará la fila y su enlace dejará de
                                      funcionar.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancelar
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        void deleteEmployee(emp.id)
                                      }
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}

      <ScheduleRowAiDialog
        open={rowAiEmployeeId != null}
        onOpenChange={(open) => {
          if (!open) setRowAiEmployeeId(null)
        }}
        schedule={schedule}
        employee={rowAiEmployee}
        onApply={applyScheduleAiRowPlan}
      />
    </div>
  )
}
