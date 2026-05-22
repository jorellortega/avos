"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  emptySupplier,
  normalizeSupplier,
  SUPPLIER_TYPE_OPTIONS,
  supplierTypeLabel,
  type SupplierRow,
} from "@/lib/proveedores-types"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"

export function ProveedoresDashboard({
  initialSuppliers,
}: {
  initialSuppliers: SupplierRow[]
}) {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [items, setItems] = useState<SupplierRow[]>(() =>
    initialSuppliers.map(normalizeSupplier),
  )
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptySupplier())

  const refresh = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      setLoadError(error.message)
      return
    }
    setItems((data ?? []).map((row) => normalizeSupplier(row as SupplierRow)))
  }, [supabase])

  useEffect(() => {
    setItems(initialSuppliers.map(normalizeSupplier))
  }, [initialSuppliers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (!showInactive && !item.is_active) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.supplier_type.toLowerCase().includes(q) ||
        item.price_notes.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.contact_name.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q)
      )
    })
  }, [items, search, showInactive])

  function openCreate() {
    setEditingId(null)
    setDraft(emptySupplier())
    setDialogOpen(true)
  }

  function openEdit(item: SupplierRow) {
    setEditingId(item.id)
    setDraft({
      name: item.name,
      phone: item.phone,
      supplier_type: supplierTypeLabel(item.supplier_type),
      price_notes: item.price_notes,
      email: item.email,
      contact_name: item.contact_name,
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
      setDraft(emptySupplier())
    }
  }

  async function saveSupplier() {
    const name = draft.name.trim()
    if (!name) {
      setLoadError("El nombre del proveedor es obligatorio.")
      return
    }

    setLoadError(null)
    setBusyId(editingId ?? "new")

    const payload = {
      name,
      phone: draft.phone.trim(),
      supplier_type: supplierTypeLabel(draft.supplier_type),
      price_notes: draft.price_notes.trim(),
      email: draft.email.trim(),
      contact_name: draft.contact_name.trim(),
      notes: draft.notes.trim(),
      is_active: draft.is_active,
      sort_order: draft.sort_order,
    }

    if (editingId) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editingId)
      setBusyId(null)
      if (error) {
        setLoadError(error.message)
        return
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === editingId ? normalizeSupplier({ ...row, ...payload }) : row,
        ),
      )
    } else {
      const maxOrder = items.reduce((m, r) => Math.max(m, r.sort_order), -1)
      const { data, error } = await supabase
        .from("suppliers")
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
          [...prev, normalizeSupplier(data as SupplierRow)].sort((a, b) =>
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

  async function deleteSupplier(id: string) {
    setBusyId(id)
    setLoadError(null)
    const { error } = await supabase.from("suppliers").delete().eq("id", id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    setItems((prev) => prev.filter((row) => row.id !== id))
  }

  async function toggleActive(item: SupplierRow) {
    setBusyId(item.id)
    const { error } = await supabase
      .from("suppliers")
      .update({ is_active: !item.is_active })
      .eq("id", item.id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    patchLocal(item.id, { is_active: !item.is_active })
  }

  function patchLocal(id: string, patch: Partial<SupplierRow>) {
    setItems((prev) =>
      prev.map((row) => (row.id === id ? normalizeSupplier({ ...row, ...patch }) : row)),
    )
  }

  const typeValue = SUPPLIER_TYPE_OPTIONS.includes(
    draft.supplier_type as (typeof SUPPLIER_TYPE_OPTIONS)[number],
  )
    ? draft.supplier_type
    : supplierTypeLabel(draft.supplier_type)

  return (
    <div className="space-y-6">
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive-suppliers"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive-suppliers" className="text-sm cursor-pointer">
              Mostrar inactivos
            </Label>
          </div>
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4 mr-1" />
            Agregar proveedor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de proveedores</CardTitle>
          <CardDescription>
            {filtered.length} de {items.length} — nombre, teléfono, tipo y precios de referencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {items.length === 0
                ? "Aún no hay proveedores. Agrega uno o corre la migración suppliers en Supabase."
                : "Ningún resultado para esta búsqueda."}
            </p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((item) => (
                <li key={item.id}>
                  <SupplierCard
                    item={item}
                    busy={busyId === item.id}
                    onEdit={() => openEdit(item)}
                    onDelete={() => void deleteSupplier(item.id)}
                    onToggleActive={() => void toggleActive(item)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpen}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar proveedor" : "Nuevo proveedor"}
            </DialogTitle>
            <DialogDescription>
              Guarda teléfono, tipo de producto y notas de precio para pedidos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="sup-name">Nombre *</Label>
              <Input
                id="sup-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej. Carnicería El Norte"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sup-phone">Teléfono</Label>
                <Input
                  id="sup-phone"
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-type">Tipo</Label>
                <Select
                  value={typeValue}
                  onValueChange={(value) =>
                    setDraft({ ...draft, supplier_type: value })
                  }
                >
                  <SelectTrigger id="sup-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TYPE_OPTIONS.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-price">Precio / referencia</Label>
              <Input
                id="sup-price"
                value={draft.price_notes}
                onChange={(e) =>
                  setDraft({ ...draft, price_notes: e.target.value })
                }
                placeholder="Ej. Arrachera $12/lb, mínimo 20 lb"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sup-contact">Persona de contacto</Label>
                <Input
                  id="sup-contact"
                  value={draft.contact_name}
                  onChange={(e) =>
                    setDraft({ ...draft, contact_name: e.target.value })
                  }
                  placeholder="Ej. Juan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-email">Correo</Label>
                <Input
                  id="sup-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="pedidos@…"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-notes">Notas</Label>
              <Textarea
                id="sup-notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Horario, días de entrega, cuenta, etc."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="sup-active"
                checked={draft.is_active}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, is_active: checked })
                }
              />
              <Label htmlFor="sup-active" className="cursor-pointer">
                Activo
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
              onClick={() => void saveSupplier()}
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

function SupplierCard({
  item,
  busy,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  item: SupplierRow
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        !item.is_active && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{item.name}</p>
          <Badge variant="secondary" className="mt-1">
            {supplierTypeLabel(item.supplier_type)}
          </Badge>
        </div>
        <div className="flex gap-0.5 shrink-0">
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
          <DeleteSupplierButton name={item.name} busy={busy} onConfirm={onDelete} />
        </div>
      </div>
      {item.phone ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Tel: </span>
          <a
            href={`tel:${item.phone.replace(/\s/g, "")}`}
            className="text-primary hover:underline"
          >
            {item.phone}
          </a>
        </p>
      ) : null}
      {item.price_notes ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Precio: </span>
          {item.price_notes}
        </p>
      ) : null}
      {(item.contact_name || item.email) && (
        <p className="text-sm text-muted-foreground">
          {item.contact_name}
          {item.contact_name && item.email ? " · " : ""}
          {item.email}
        </p>
      )}
      {item.notes ? (
        <p className="text-sm text-muted-foreground">{item.notes}</p>
      ) : null}
      <div className="flex items-center gap-2">
        <Switch checked={item.is_active} disabled={busy} onCheckedChange={onToggleActive} />
        <span className="text-xs text-muted-foreground">Activo</span>
      </div>
    </div>
  )
}

function DeleteSupplierButton({
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
          <AlertDialogTitle>¿Eliminar {name || "este proveedor"}?</AlertDialogTitle>
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
