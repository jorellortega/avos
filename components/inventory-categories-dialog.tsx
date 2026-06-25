"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  normalizeStockCategory,
  type InventoryStockCategoryRow,
} from "@/lib/inventario-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Plus, Trash2 } from "lucide-react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: InventoryStockCategoryRow[]
  itemCountByCategory: Record<string, number>
  onCategoriesChange: (categories: InventoryStockCategoryRow[]) => void
  onItemsCategoryRenamed: (oldName: string, newName: string) => void
}

export function InventoryCategoriesDialog({
  open,
  onOpenChange,
  categories,
  itemCountByCategory,
  onCategoriesChange,
  onItemsCategoryRenamed,
}: Props) {
  const supabase = createBrowserSupabase()
  const [rows, setRows] = useState<InventoryStockCategoryRow[]>(categories)
  const [newName, setNewName] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InventoryStockCategoryRow | null>(
    null,
  )

  useEffect(() => {
    if (open) {
      setRows(categories.map(normalizeStockCategory))
      setNewName("")
      setLoadError(null)
    }
  }, [open, categories])

  const refreshCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("inventory_stock_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
    if (error) throw new Error(error.message)
    const list = (data ?? []).map((r) =>
      normalizeStockCategory(r as InventoryStockCategoryRow),
    )
    onCategoriesChange(list)
    setRows(list)
    return list
  }, [supabase, onCategoriesChange])

  async function saveRow(row: InventoryStockCategoryRow, patch: Partial<InventoryStockCategoryRow>) {
    const prev = rows.find((r) => r.id === row.id)
    if (!prev) return

    const name = (patch.name ?? prev.name).trim()
    if (!name) {
      setLoadError("El nombre no puede estar vacío.")
      return
    }

    setBusy(true)
    setLoadError(null)

    const { error } = await supabase
      .from("inventory_stock_categories")
      .update({
        name,
        show_marinated: patch.show_marinated ?? prev.show_marinated,
        show_quantity_kg: patch.show_quantity_kg ?? prev.show_quantity_kg,
      })
      .eq("id", row.id)

    if (error) {
      setLoadError(error.message)
      setBusy(false)
      return
    }

    if (prev.name !== name) {
      const { error: itemsErr } = await supabase
        .from("inventory_items")
        .update({ category: name })
        .eq("list_kind", "stock")
        .eq("category", prev.name)
      if (itemsErr) {
        setLoadError(itemsErr.message)
        setBusy(false)
        return
      }
      onItemsCategoryRenamed(prev.name, name)
    }

    await refreshCategories()
    setBusy(false)
  }

  async function addCategory() {
    const name = newName.trim()
    if (!name) {
      setLoadError("Escribe un nombre para la categoría.")
      return
    }
    setBusy(true)
    setLoadError(null)
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), -1)
    const { error } = await supabase.from("inventory_stock_categories").insert({
      name,
      sort_order: maxOrder + 10,
      show_marinated: false,
      show_quantity_kg: true,
    })
    setBusy(false)
    if (error) {
      setLoadError(error.message)
      return
    }
    setNewName("")
    await refreshCategories()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const count = itemCountByCategory[deleteTarget.name] ?? 0
    if (count > 0) {
      setLoadError(
        `No se puede eliminar «${deleteTarget.name}»: tiene ${count} producto(s). Muévelos a otra categoría primero.`,
      )
      setDeleteTarget(null)
      return
    }

    setBusy(true)
    setLoadError(null)
    const { error } = await supabase
      .from("inventory_stock_categories")
      .delete()
      .eq("id", deleteTarget.id)
    setBusy(false)
    setDeleteTarget(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    await refreshCategories()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Categorías de inventario</DialogTitle>
            <DialogDescription>
              Agrega, renombra o elimina secciones (Tomates, Especias, Proteínas…).
              Al renombrar, los productos de esa sección se actualizan.
            </DialogDescription>
          </DialogHeader>

          {loadError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          <ul className="space-y-3 py-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
              >
                <div className="flex-1 min-w-0">
                  <Label className="sr-only" htmlFor={`cat-name-${row.id}`}>
                    Nombre
                  </Label>
                  <Input
                    id={`cat-name-${row.id}`}
                    value={row.name}
                    disabled={busy}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                    onBlur={(e) => {
                      const name = e.target.value.trim()
                      const original =
                        categories.find((c) => c.id === row.id)?.name ?? ""
                      if (name && name !== original) {
                        void saveRow(row, { name })
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(itemCountByCategory[row.name] ?? 0)} producto
                    {(itemCountByCategory[row.name] ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0 sm:items-end">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`cat-kg-${row.id}`}
                      checked={row.show_quantity_kg}
                      disabled={busy}
                      onCheckedChange={(checked) => {
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? { ...r, show_quantity_kg: checked }
                              : r,
                          ),
                        )
                        void saveRow(row, { show_quantity_kg: checked })
                      }}
                    />
                    <Label
                      htmlFor={`cat-kg-${row.id}`}
                      className="text-xs cursor-pointer whitespace-nowrap"
                    >
                      Kilos
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`cat-mar-${row.id}`}
                      checked={row.show_marinated}
                      disabled={busy}
                      onCheckedChange={(checked) => {
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? { ...r, show_marinated: checked }
                              : r,
                          ),
                        )
                        void saveRow(row, { show_marinated: checked })
                      }}
                    />
                    <Label
                      htmlFor={`cat-mar-${row.id}`}
                      className="text-xs cursor-pointer whitespace-nowrap"
                    >
                      Marinado
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    disabled={busy}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva categoría…"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addCategory()
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void addCategory()}
            >
              <Plus className="size-4 mr-1" />
              Agregar
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar «{deleteTarget?.name}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede eliminar si no tiene productos asignados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
