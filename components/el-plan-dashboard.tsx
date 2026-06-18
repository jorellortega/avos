"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  elPlanFormatDateLabel,
  elPlanShiftDate,
  elPlanTodayDate,
  emptyElPlanItem,
  normalizeElPlanItem,
  type ElPlanDayRow,
  type ElPlanItemRow,
} from "@/lib/el-plan-types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

type ElPlanDashboardProps = {
  userId: string
  initialPlanDate: string
  initialDay: ElPlanDayRow
  initialItems: ElPlanItemRow[]
}

export function ElPlanDashboard({
  userId,
  initialPlanDate,
  initialDay,
  initialItems,
}: ElPlanDashboardProps) {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [planDate, setPlanDate] = useState(initialPlanDate)
  const [dayNotes, setDayNotes] = useState(initialDay.notes ?? "")
  const [items, setItems] = useState<ElPlanItemRow[]>(() =>
    initialItems.map(normalizeElPlanItem),
  )
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftNotes, setDraftNotes] = useState("")
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = elPlanTodayDate()
  const isToday = planDate === today

  const loadPlan = useCallback(
    async (date: string) => {
      setLoading(true)
      setLoadError(null)
      const [{ data: dayRow, error: dayError }, { data: itemRows, error: itemsError }] =
        await Promise.all([
          supabase
            .from("el_plan_days")
            .select("*")
            .eq("plan_date", date)
            .maybeSingle(),
          supabase
            .from("el_plan_items")
            .select("*")
            .eq("plan_date", date)
            .order("sort_order", { ascending: true })
            .order("title", { ascending: true }),
        ])

      setLoading(false)
      if (dayError || itemsError) {
        setLoadError(dayError?.message ?? itemsError?.message ?? "Error al cargar")
        return
      }
      setDayNotes((dayRow as ElPlanDayRow | null)?.notes ?? "")
      setItems((itemRows ?? []).map((row) => normalizeElPlanItem(row as ElPlanItemRow)))
    },
    [supabase],
  )

  useEffect(() => {
    if (planDate === initialPlanDate) {
      setDayNotes(initialDay.notes ?? "")
      setItems(initialItems.map(normalizeElPlanItem))
      return
    }
    void loadPlan(planDate)
  }, [planDate, initialPlanDate, initialDay, initialItems, loadPlan])

  const completedCount = useMemo(
    () => items.filter((item) => item.completed).length,
    [items],
  )
  const totalCount = items.length
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const saveDayNotes = useCallback(
    async (notes: string) => {
      setSavingNotes(true)
      const { error } = await supabase.from("el_plan_days").upsert(
        { plan_date: planDate, notes },
        { onConflict: "plan_date" },
      )
      setSavingNotes(false)
      if (error) setLoadError(error.message)
    },
    [supabase, planDate],
  )

  function handleNotesChange(value: string) {
    setDayNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      void saveDayNotes(value)
    }, 600)
  }

  async function toggleItem(item: ElPlanItemRow) {
    const nextCompleted = !item.completed
    setBusyId(item.id)
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              completed: nextCompleted,
              completed_at: nextCompleted ? new Date().toISOString() : null,
              completed_by: nextCompleted ? userId : null,
            }
          : row,
      ),
    )

    const { error } = await supabase
      .from("el_plan_items")
      .update({
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
        completed_by: nextCompleted ? userId : null,
      })
      .eq("id", item.id)

    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      void loadPlan(planDate)
    }
  }

  function openCreate() {
    setEditingId(null)
    setDraftTitle("")
    setDraftNotes("")
    setDialogOpen(true)
  }

  function openEdit(item: ElPlanItemRow) {
    setEditingId(item.id)
    setDraftTitle(item.title)
    setDraftNotes(item.item_notes)
    setDialogOpen(true)
  }

  async function saveItem() {
    const title = draftTitle.trim()
    if (!title) return

    setBusyId(editingId ?? "new")
    if (editingId) {
      const { error } = await supabase
        .from("el_plan_items")
        .update({ title, item_notes: draftNotes.trim() })
        .eq("id", editingId)

      setBusyId(null)
      if (error) {
        setLoadError(error.message)
        return
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === editingId
            ? { ...row, title, item_notes: draftNotes.trim() }
            : row,
        ),
      )
    } else {
      const maxSort = items.reduce((max, row) => Math.max(max, row.sort_order), -1)
      const payload = {
        ...emptyElPlanItem(planDate),
        title,
        item_notes: draftNotes.trim(),
        sort_order: maxSort + 1,
      }
      const { data, error } = await supabase
        .from("el_plan_items")
        .insert(payload)
        .select("*")
        .single()

      setBusyId(null)
      if (error) {
        setLoadError(error.message)
        return
      }
      setItems((prev) => [...prev, normalizeElPlanItem(data as ElPlanItemRow)])
    }

    setDialogOpen(false)
  }

  async function deleteItem(id: string) {
    setBusyId(id)
    const { error } = await supabase.from("el_plan_items").delete().eq("id", id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    setItems((prev) => prev.filter((row) => row.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Día anterior"
            onClick={() => setPlanDate((d) => elPlanShiftDate(d, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[12rem]">
            <p className="font-medium capitalize flex items-center justify-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {elPlanFormatDateLabel(planDate)}
            </p>
            {!isToday && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setPlanDate(today)}
              >
                Ir a hoy
              </Button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Día siguiente"
            onClick={() => setPlanDate((d) => elPlanShiftDate(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {totalCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {completedCount} de {totalCount} listas ({progressPct}%)
          </p>
        )}
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Notas del día</CardTitle>
          <CardDescription>
            Instrucciones generales, recordatorios o contexto para el turno.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Textarea
              value={dayNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Ej. Hoy hay evento a las 6pm, dejar mesas listas…"
              rows={4}
              disabled={loading}
              className="resize-y min-h-[6rem]"
            />
            {savingNotes && (
              <span className="absolute bottom-2 right-2 text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Guardando…
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">Tareas</CardTitle>
            <CardDescription>
              Marca cada punto cuando esté listo.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openCreate} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay tareas para este día. Agrega la primera arriba.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                    item.completed && "bg-muted/40 border-muted",
                  )}
                >
                  <Checkbox
                    id={`el-plan-${item.id}`}
                    checked={item.completed}
                    disabled={busyId === item.id}
                    onCheckedChange={() => void toggleItem(item)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <label
                      htmlFor={`el-plan-${item.id}`}
                      className={cn(
                        "font-medium cursor-pointer block",
                        item.completed && "line-through text-muted-foreground",
                      )}
                    >
                      {item.title}
                    </label>
                    {item.item_notes ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.item_notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Editar tarea"
                      onClick={() => openEdit(item)}
                      disabled={busyId === item.id}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Eliminar tarea"
                          disabled={busyId === item.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se quitará &ldquo;{item.title}&rdquo; del plan de este
                            día.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void deleteItem(item.id)}
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {totalCount > 0 && (
            <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar tarea" : "Nueva tarea"}
            </DialogTitle>
            <DialogDescription>
              Título breve y notas opcionales para el equipo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="el-plan-title">Tarea</Label>
              <Input
                id="el-plan-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Ej. Revisar inventario de salsas"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="el-plan-item-notes">Notas (opcional)</Label>
              <Textarea
                id="el-plan-item-notes"
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="Detalles extra…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void saveItem()}
              disabled={!draftTitle.trim() || busyId !== null}
            >
              {busyId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                "Guardar"
              ) : (
                "Agregar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
