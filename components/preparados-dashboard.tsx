"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  emptyPrepItem,
  findPrepStatusOption,
  findPrepTempOption,
  groupPrepItemsByCategory,
  normalizePrepItem,
  normalizePrepStatusSlug,
  PREP_CATEGORIES,
  PREP_SELECT_BLANK,
  PREP_STATUS_OPTIONS,
  PREP_TEMP_OPTIONS,
  prepCategoryLabel,
  prepStatusLabel,
  type PrepReadyItemRow,
  type PrepStatusValue,
  type PrepTempState,
} from "@/lib/preparados-types"
import { cn } from "@/lib/utils"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Check, ChevronDown, Pencil, Plus, Search, Trash2 } from "lucide-react"

type TempFilter = "all" | PrepTempState
type StatusFilter = "all" | PrepStatusValue

export function PreparadosDashboard({
  initialItems,
}: {
  initialItems: PrepReadyItemRow[]
}) {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [items, setItems] = useState<PrepReadyItemRow[]>(() =>
    initialItems.map(normalizePrepItem),
  )
  const [search, setSearch] = useState("")
  const [tempFilter, setTempFilter] = useState<TempFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [showInactive, setShowInactive] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyPrepItem())

  const refresh = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from("prep_ready_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      setLoadError(error.message)
      return
    }
    setItems((data ?? []).map((row) => normalizePrepItem(row as PrepReadyItemRow)))
  }, [supabase])

  useEffect(() => {
    setItems(initialItems.map(normalizePrepItem))
  }, [initialItems])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (!showInactive && !item.is_active) return false
      if (tempFilter !== "all" && item.temp_state !== tempFilter) return false
      if (statusFilter !== "all") {
        const slug = normalizePrepStatusSlug(item.prep_status)
        if (slug !== statusFilter) return false
      }
      if (!q) return true
      const temp = findPrepTempOption(item.temp_state)?.label ?? ""
      const status = prepStatusLabel(item.prep_status) ?? ""
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q) ||
        temp.toLowerCase().includes(q) ||
        status.toLowerCase().includes(q)
      )
    })
  }, [items, search, showInactive, tempFilter, statusFilter])

  const grouped = useMemo(() => groupPrepItemsByCategory(filtered), [filtered])

  function openCreate(presetCategory?: string) {
    setEditingId(null)
    setDraft(
      presetCategory
        ? { ...emptyPrepItem(), category: prepCategoryLabel(presetCategory) }
        : emptyPrepItem(),
    )
    setDialogOpen(true)
  }

  function openEdit(item: PrepReadyItemRow) {
    setEditingId(item.id)
    setDraft({
      name: item.name,
      temp_state: item.temp_state,
      prep_status: item.prep_status,
      category: item.category,
      notes: item.notes,
      is_active: item.is_active,
      sort_order: item.sort_order,
    })
    setDialogOpen(true)
  }

  function handleDialogOpen(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditingId(null)
      setDraft(emptyPrepItem())
    }
  }

  function patchLocal(id: string, patch: Partial<PrepReadyItemRow>) {
    setItems((prev) =>
      prev.map((row) =>
        row.id === id ? normalizePrepItem({ ...row, ...patch }) : row,
      ),
    )
  }

  async function saveItem() {
    const name = draft.name.trim()
    if (!name) {
      setLoadError("El nombre es obligatorio.")
      return
    }

    setLoadError(null)
    setBusyId(editingId ?? "new")

    const payload = {
      name,
      temp_state: draft.temp_state,
      prep_status: normalizePrepStatusSlug(draft.prep_status),
      category: prepCategoryLabel(draft.category),
      notes: draft.notes.trim(),
      is_active: draft.is_active,
      sort_order: draft.sort_order,
    }

    if (editingId) {
      const { error } = await supabase
        .from("prep_ready_items")
        .update(payload)
        .eq("id", editingId)
      setBusyId(null)
      if (error) {
        setLoadError(error.message)
        return
      }
      patchLocal(editingId, payload)
    } else {
      const maxOrder = items.reduce((m, r) => Math.max(m, r.sort_order), -1)
      const { data, error } = await supabase
        .from("prep_ready_items")
        .insert({ ...payload, sort_order: maxOrder + 1 })
        .select()
        .single()
      setBusyId(null)
      if (error) {
        setLoadError(error.message)
        return
      }
      if (data) {
        setItems((prev) =>
          [...prev, normalizePrepItem(data as PrepReadyItemRow)].sort((a, b) =>
            a.name.localeCompare(b.name, "es"),
          ),
        )
      } else {
        await refresh()
      }
    }

    const scrollY = window.scrollY
    handleDialogOpen(false)
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY)
    })
  }

  async function setTemp(item: PrepReadyItemRow, temp: PrepTempState) {
    if (item.temp_state === temp) return
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { temp_state: temp })
    const { error } = await supabase
      .from("prep_ready_items")
      .update({ temp_state: temp })
      .eq("id", item.id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      await refresh()
    }
  }

  async function setStatus(item: PrepReadyItemRow, status: PrepStatusValue | "") {
    const slug = normalizePrepStatusSlug(status)
    if (normalizePrepStatusSlug(item.prep_status) === slug) return
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { prep_status: slug })
    const { error } = await supabase
      .from("prep_ready_items")
      .update({ prep_status: slug })
      .eq("id", item.id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      await refresh()
    }
  }

  async function setCategory(item: PrepReadyItemRow, category: string) {
    const cat = prepCategoryLabel(category)
    if (item.category === cat) return
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { category: cat })
    const { error } = await supabase
      .from("prep_ready_items")
      .update({ category: cat })
      .eq("id", item.id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      await refresh()
    }
  }

  async function deleteItem(id: string) {
    setBusyId(id)
    const { error } = await supabase.from("prep_ready_items").delete().eq("id", id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    setItems((prev) => prev.filter((row) => row.id !== id))
  }

  const categoryValue = PREP_CATEGORIES.includes(
    draft.category as (typeof PREP_CATEGORIES)[number],
  )
    ? draft.category
    : prepCategoryLabel(draft.category)

  return (
    <div className="space-y-6">
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={tempFilter === "all" ? "default" : "outline"}
            onClick={() => setTempFilter("all")}
          >
            Todos
          </Button>
          {PREP_TEMP_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={tempFilter === opt.id ? "default" : "outline"}
              className={cn(
                tempFilter !== opt.id && "gap-1.5",
              )}
              onClick={() => setTempFilter(opt.id)}
            >
              <span
                className={cn("size-2 rounded-full shrink-0", opt.dotClass)}
                aria-hidden
              />
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={statusFilter === "all" ? "secondary" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            Todos los estados
          </Button>
          {PREP_STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={statusFilter === opt.id ? "secondary" : "outline"}
              className={cn(
                statusFilter === opt.id && opt.badgeClass,
                statusFilter !== opt.id && "gap-1.5",
              )}
              onClick={() => setStatusFilter(opt.id)}
            >
              <span
                className={cn("size-2 rounded-full shrink-0", opt.dotClass)}
                aria-hidden
              />
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar preparado…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive-prep"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive-prep" className="text-sm cursor-pointer">
                Mostrar inactivos
              </Label>
            </div>
            <Button type="button" onClick={() => openCreate()}>
              <Plus className="size-4 mr-1" />
              Agregar
            </Button>
          </div>
        </div>
      </div>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? "Sin preparados. Corre la migración prep_ready_items en Supabase o agrega el primero."
              : "Ningún resultado con este filtro."}
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.category}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
              <div>
                <CardTitle>{group.category}</CardTitle>
                <CardDescription>
                  {group.items.length} preparado
                  {group.items.length === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => openCreate(group.category)}
              >
                <Plus className="size-4 mr-1" />
                Agregar
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <PrepItemCard
                      item={item}
                      busy={busyId === item.id}
                      onEdit={() => openEdit(item)}
                      onDelete={() => void deleteItem(item.id)}
                      onSetTemp={(temp) => void setTemp(item, temp)}
                      onSetStatus={(status) => void setStatus(item, status)}
                      onSetCategory={(cat) => void setCategory(item, cat)}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpen}>
        <DialogContent
          className="max-w-lg"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar preparado" : "Nuevo preparado"}
            </DialogTitle>
            <DialogDescription>
              Ej. Pico de Gallo, frijoles, arroz — indica si va congelado, caliente o frío.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="prep-name">Nombre *</Label>
              <Input
                id="prep-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej. Pico de Gallo"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Estado</Label>
                <Select
                  value={
                    normalizePrepStatusSlug(draft.prep_status) || "_none"
                  }
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      prep_status: v === "_none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={PREP_SELECT_BLANK} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{PREP_SELECT_BLANK}</SelectItem>
                    {PREP_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temperatura</Label>
                <Select
                  value={draft.temp_state}
                  onValueChange={(v) =>
                    setDraft({ ...draft, temp_state: v as PrepTempState })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PREP_TEMP_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={categoryValue}
                  onValueChange={(v) => setDraft({ ...draft, category: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PREP_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prep-notes">Notas</Label>
              <Textarea
                id="prep-notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Contenedor, duración, par level…"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="prep-active"
                checked={draft.is_active}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, is_active: checked })
                }
              />
              <Label htmlFor="prep-active" className="cursor-pointer">
                Activo en lista
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={busyId != null}
              onClick={() => void saveItem()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground text-center">
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => void refresh()}
        >
          Actualizar lista
        </button>
      </p>
    </div>
  )
}

function PrepItemCard({
  item,
  busy,
  onEdit,
  onDelete,
  onSetTemp,
  onSetStatus,
  onSetCategory,
}: {
  item: PrepReadyItemRow
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onSetTemp: (temp: PrepTempState) => void
  onSetStatus: (status: PrepStatusValue | "") => void
  onSetCategory: (category: string) => void
}) {
  const statusOpt = findPrepStatusOption(item.prep_status)
  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex flex-col gap-3",
        !item.is_active && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-base">{item.name}</p>
            {statusOpt ? (
              <Badge
                variant="outline"
                className={cn("text-xs font-medium", statusOpt.badgeClass)}
              >
                {statusOpt.label}
              </Badge>
            ) : null}
          </div>
          {item.notes ? (
            <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy}
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
          <DeletePrepButton
            name={item.name}
            busy={busy}
            onConfirm={onDelete}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PrepStatusMenu item={item} busy={busy} onSetStatus={onSetStatus} />
        <PrepCategoryMenu
          item={item}
          busy={busy}
          onSetCategory={onSetCategory}
        />
        <PrepTempMenu item={item} busy={busy} onSetTemp={onSetTemp} />
      </div>
    </div>
  )
}

function PrepStatusMenu({
  item,
  busy,
  onSetStatus,
}: {
  item: PrepReadyItemRow
  busy: boolean
  onSetStatus: (status: PrepStatusValue | "") => void
}) {
  const active = findPrepStatusOption(item.prep_status)
  const slug = normalizePrepStatusSlug(item.prep_status)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className={cn(
            "h-9 min-w-[9rem] justify-between gap-1 font-normal",
            active?.badgeClass ?? "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {active ? (
              <span
                className={cn("size-2 rounded-full shrink-0", active.dotClass)}
                aria-hidden
              />
            ) : null}
            <span>
              <span className="text-muted-foreground">Estado: </span>
              {active?.label ?? PREP_SELECT_BLANK}
            </span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[11rem]">
        <DropdownMenuItem onClick={() => onSetStatus("")}>
          {PREP_SELECT_BLANK}
          {!slug && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
        {PREP_STATUS_OPTIONS.map((opt) => {
          const selected = slug === opt.id
          return (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => onSetStatus(opt.id)}
            >
              <span
                className={cn("size-2 rounded-full mr-2 shrink-0", opt.dotClass)}
                aria-hidden
              />
              {opt.label}
              {selected && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PrepCategoryMenu({
  item,
  busy,
  onSetCategory,
}: {
  item: PrepReadyItemRow
  busy: boolean
  onSetCategory: (category: string) => void
}) {
  const label = prepCategoryLabel(item.category)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="h-9 min-w-[9rem] max-w-[11rem] justify-between gap-1 px-2 text-xs font-normal"
        >
          <span className="truncate text-left">
            <span className="text-muted-foreground">Categoría: </span>
            {label}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem]">
        {PREP_CATEGORIES.map((cat) => {
          const selected = prepCategoryLabel(item.category) === cat
          return (
            <DropdownMenuItem
              key={cat}
              onClick={() => onSetCategory(cat)}
            >
              {cat}
              {selected && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PrepTempMenu({
  item,
  busy,
  onSetTemp,
}: {
  item: PrepReadyItemRow
  busy: boolean
  onSetTemp: (temp: PrepTempState) => void
}) {
  const active = findPrepTempOption(item.temp_state)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className={cn(
            "h-9 min-w-[8.5rem] justify-between gap-1 font-normal",
            active?.badgeClass,
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <span
              className={cn("size-2 rounded-full shrink-0", active?.dotClass)}
              aria-hidden
            />
            {active?.label ?? "Temperatura"}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {PREP_TEMP_OPTIONS.map((opt) => {
          const selected = item.temp_state === opt.id
          return (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => onSetTemp(opt.id)}
            >
              <span
                className={cn("size-2 rounded-full mr-2 shrink-0", opt.dotClass)}
                aria-hidden
              />
              {opt.label}
              {selected && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DeletePrepButton({
  name,
  busy,
  onConfirm,
}: {
  name: string
  busy: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-destructive"
          disabled={busy}
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar {name || "este preparado"}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se quitará de la lista permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
