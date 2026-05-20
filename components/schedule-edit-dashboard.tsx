"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type {
  StaffScheduleEmployeeRow,
  StaffScheduleRow,
  ScheduleDayKey,
  ScheduleShiftKey,
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
import { Copy, Link2, Plus, Trash2 } from "lucide-react"

function employeeSharePath(token: string) {
  return `/horario/e/${token}`
}

export function ScheduleEditDashboard() {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [schedule, setSchedule] = useState<StaffScheduleRow | null>(null)
  const [employees, setEmployees] = useState<StaffScheduleEmployeeRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [savedHeader, setSavedHeader] = useState(false)

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

  async function addEmployee(shift: ScheduleShiftKey) {
    if (!schedule) return
    setBusyId(`new-${shift}`)
    const inShift = employees.filter((e) => e.shift === shift)
    const sortOrder =
      inShift.length > 0 ? Math.max(...inShift.map((e) => e.sort_order)) + 1 : 0

    const { data, error } = await supabase
      .from("staff_schedule_employees")
      .insert({
        schedule_id: schedule.id,
        name: "",
        shift,
        sort_order: sortOrder,
      })
      .select("*")
      .single()

    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    setEmployees((prev) => [...prev, data as StaffScheduleEmployeeRow])
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
    value: string,
  ) {
    setEmployees((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    )
  }

  function handleDayBlur(
    emp: StaffScheduleEmployeeRow,
    day: ScheduleDayKey,
    value: string,
  ) {
    if (emp[day] === value) return
    void updateEmployee(emp.id, { [day]: value })
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
        <CardHeader>
          <CardTitle>Semana</CardTitle>
          <CardDescription>
            Pon el título y publica cuando esté listo. Cada empleado tendrá su
            propio enlace para ver solo su horario.
          </CardDescription>
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
                    {SCHEDULE_DAY_KEYS.map((day) => (
                      <TableHead
                        key={day}
                        className="min-w-[100px] text-center"
                      >
                        {SCHEDULE_DAY_LABELS[day]}
                      </TableHead>
                    ))}
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
                          SCHEDULE_DAY_KEYS.length + 2
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
                          <Input
                            value={emp.name}
                            onChange={(e) =>
                              updateLocalEmployee(
                                emp.id,
                                "name",
                                e.target.value,
                              )
                            }
                            onBlur={(e) => {
                              const name = e.target.value.trim()
                              if (name !== emp.name) {
                                void updateEmployee(emp.id, { name })
                              }
                            }}
                            placeholder="Nombre"
                            className="min-w-[120px]"
                          />
                        </TableCell>
                        {SCHEDULE_DAY_KEYS.map((day) => (
                            <TableCell key={day} className="p-1">
                              <Input
                                value={emp[day]}
                                onChange={(e) =>
                                  updateLocalEmployee(
                                    emp.id,
                                    day,
                                    e.target.value,
                                  )
                                }
                                onBlur={(e) =>
                                  handleDayBlur(emp, day, e.target.value)
                                }
                                placeholder="—"
                                className="text-center text-sm min-w-[90px]"
                              />
                            </TableCell>
                        ))}
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
    </div>
  )
}
