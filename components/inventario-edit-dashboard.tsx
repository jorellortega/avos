"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type {
  InventoryItemRow,
  InventoryListKind,
  StockBolsasPreset,
  StockCountPreset,
  StockQuantityPreset,
  StockStatusOption,
} from "@/lib/inventario-types"
import {
  findStockBolsasPresetForItem,
  findStockCountPresetForItem,
  findStockQuantityPresetForItem,
  findStockStatusForNotes,
  groupStockItemsByCategory,
  INVENTORY_SELECT_BLANK,
  INVENTORY_SELECT_NONE,
  INVENTORY_STOCK_CATEGORIES,
  inventoryCategoryLabel,
  STOCK_BOLSAS_PRESETS,
  STOCK_COUNT_PRESETS,
  STOCK_QUANTITY_PRESETS,
  STOCK_QUICK_ACTIONS,
  STOCK_STATUS_OPTIONS,
  stockBolsasPresetIsActive,
  stockCountPresetIsActive,
  stockQuickActionIsActive,
  stockQuantityPresetIsActive,
} from "@/lib/inventario-types"
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
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InventarioEmpiezaDialog } from "@/components/inventario-empieza-dialog"
import { InventoryAiScanButton } from "@/components/inventory-ai-scan-button"
import { InventoryItemThumb } from "@/components/inventory-item-thumb"
import { Check, ChevronDown, Plus, Search, Trash2 } from "lucide-react"

function normalizeItem(row: InventoryItemRow): InventoryItemRow {
  return {
    ...row,
    list_kind: row.list_kind === "shopping" ? "shopping" : "stock",
    image_url: typeof row.image_url === "string" ? row.image_url : "",
    purchased: Boolean(row.purchased),
    quantity: Number(row.quantity) || 0,
    bolsas:
      row.bolsas == null || row.bolsas === undefined
        ? null
        : Number(row.bolsas),
    cantidad_num:
      row.cantidad_num == null || row.cantidad_num === undefined
        ? null
        : Number(row.cantidad_num),
    par_level: row.par_level == null ? null : Number(row.par_level),
  }
}

function sortItems(list: InventoryItemRow[]): InventoryItemRow[] {
  return [...list].map(normalizeItem).sort((a, b) => {
    if (a.purchased !== b.purchased) return a.purchased ? 1 : -1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name, "es")
  })
}

function emptyItem(kind: InventoryListKind): Omit<
  InventoryItemRow,
  "id" | "created_at" | "updated_at"
> {
  return {
    name: "",
    image_url: "",
    category: INVENTORY_STOCK_CATEGORIES[0],
    unit: kind === "stock" ? "kg" : "pza",
    quantity: 0,
    bolsas: null,
    cantidad_num: null,
    par_level: null,
    notes: "",
    list_kind: kind,
    purchased: false,
    is_active: true,
    sort_order: 0,
  }
}

export function InventarioEditDashboard({
  initialItems,
}: {
  initialItems: InventoryItemRow[]
}) {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [items, setItems] = useState<InventoryItemRow[]>(() =>
    sortItems(initialItems),
  )
  const [tab, setTab] = useState<InventoryListKind>("stock")
  const [search, setSearch] = useState("")
  const [showPurchased, setShowPurchased] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addScanFeedback, setAddScanFeedback] = useState<string | null>(null)
  const [empiezaOpen, setEmpiezaOpen] = useState(false)
  const [draft, setDraft] = useState(emptyItem("stock"))

  useEffect(() => {
    setItems(sortItems(initialItems))
  }, [initialItems])

  useEffect(() => {
    setDraft(emptyItem(tab))
  }, [tab])

  const refresh = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      setLoadError(error.message)
      return
    }
    setItems(sortItems((data ?? []) as InventoryItemRow[]))
  }, [supabase])

  const stockItems = useMemo(
    () => items.filter((i) => i.list_kind === "stock"),
    [items],
  )
  const shoppingItems = useMemo(
    () => items.filter((i) => i.list_kind === "shopping"),
    [items],
  )

  const tabItems = tab === "stock" ? stockItems : shoppingItems

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = tabItems
    if (tab === "shopping" && !showPurchased) {
      list = list.filter((i) => !i.purchased)
    }
    if (!q) return list
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    )
  }, [tabItems, search, tab, showPurchased])

  const shoppingPending = useMemo(
    () => shoppingItems.filter((i) => !i.purchased).length,
    [shoppingItems],
  )

  const stockByCategory = useMemo(
    () => groupStockItemsByCategory(filtered),
    [filtered],
  )

  function patchLocal(id: string, patch: Partial<InventoryItemRow>) {
    setItems((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }

  async function saveItemFields(id: string, patch: Partial<InventoryItemRow>) {
    setLoadError(null)
    const { error } = await supabase
      .from("inventory_items")
      .update(patch)
      .eq("id", id)

    if (error) {
      setLoadError(error.message)
      return false
    }
    patchLocal(id, patch)
    return true
  }

  async function adjustQuantity(
    item: InventoryItemRow,
    delta: number,
    reason: string,
  ) {
    const next = Math.max(0, Number(item.quantity) + delta)
    if (next === item.quantity) return

    setBusyId(item.id)
    setLoadError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error: adjErr } = await supabase.from("inventory_adjustments").insert({
      item_id: item.id,
      delta,
      reason,
      created_by: user?.id ?? null,
    })

    if (adjErr) {
      setBusyId(null)
      setLoadError(adjErr.message)
      return
    }

    const ok = await saveItemFields(item.id, { quantity: next })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function addItem() {
    const name = draft.name.trim()
    if (!name) {
      setLoadError("El nombre es obligatorio.")
      return
    }

    setLoadError(null)
    const inList = items.filter((i) => i.list_kind === tab)
    const maxOrder = inList.reduce((m, r) => Math.max(m, r.sort_order), -1)

    const { error } = await supabase.from("inventory_items").insert({
      name,
      image_url: draft.image_url.trim(),
      category:
        tab === "stock"
          ? inventoryCategoryLabel(draft.category)
          : draft.category.trim(),
      unit: tab === "stock" ? draft.unit.trim() || "kg" : "pza",
      quantity: tab === "stock" ? draft.quantity : 0,
      bolsas: tab === "stock" ? draft.bolsas : null,
      cantidad_num: tab === "stock" ? draft.cantidad_num : null,
      par_level: tab === "stock" ? draft.par_level : null,
      notes: draft.notes.trim(),
      list_kind: tab,
      purchased: false,
      is_active: true,
      sort_order: maxOrder + 1,
    })

    if (error) {
      setLoadError(error.message)
      return
    }

    setAddOpen(false)
    setDraft(emptyItem(tab))
    await refresh()
  }

  async function applyStockStatus(
    item: InventoryItemRow,
    option: StockStatusOption,
  ) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { notes: option.notes })
    const ok = await saveItemFields(item.id, { notes: option.notes })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function applyStockQuantityPreset(
    item: InventoryItemRow,
    preset: StockQuantityPreset,
  ) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { quantity: preset.quantity, unit: preset.unit })

    const qDelta = preset.quantity - Number(item.quantity)
    if (qDelta !== 0) {
      await adjustQuantity(item, qDelta, preset.label)
    }

    const ok = await saveItemFields(item.id, {
      quantity: preset.quantity,
      unit: preset.unit,
    })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function applyStockBolsasPreset(
    item: InventoryItemRow,
    preset: StockBolsasPreset,
  ) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { bolsas: preset.bolsas })
    const ok = await saveItemFields(item.id, { bolsas: preset.bolsas })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function clearStockStatus(item: InventoryItemRow) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { notes: "" })
    const ok = await saveItemFields(item.id, { notes: "" })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function clearStockQuantity(item: InventoryItemRow) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { quantity: 0, unit: "kg" })

    const qDelta = 0 - Number(item.quantity)
    if (qDelta !== 0) {
      await adjustQuantity(item, qDelta, "Sin cantidad")
    }

    const ok = await saveItemFields(item.id, { quantity: 0, unit: "kg" })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function clearStockBolsas(item: InventoryItemRow) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { bolsas: null })
    const ok = await saveItemFields(item.id, { bolsas: null })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function applyStockCountPreset(
    item: InventoryItemRow,
    preset: StockCountPreset,
  ) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { cantidad_num: preset.cantidad_num })
    const ok = await saveItemFields(item.id, {
      cantidad_num: preset.cantidad_num,
    })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function applyAiScan(
    item: InventoryItemRow,
    patch: Partial<InventoryItemRow>,
  ) {
    if (Object.keys(patch).length === 0) {
      setLoadError("La IA no detectó cambios en estado o cantidades.")
      return
    }
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, patch)
    const ok = await saveItemFields(item.id, patch)
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function applyInventoryImage(item: InventoryItemRow, imageUrl: string) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { image_url: imageUrl })
    const ok = await saveItemFields(item.id, { image_url: imageUrl })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function clearStockCount(item: InventoryItemRow) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { cantidad_num: null })
    const ok = await saveItemFields(item.id, { cantidad_num: null })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function deleteItem(id: string) {
    setBusyId(id)
    setLoadError(null)
    const { error } = await supabase.from("inventory_items").delete().eq("id", id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    setItems((prev) => prev.filter((row) => row.id !== id))
  }

  function openAddDialog(presetCategory?: string) {
    const base = emptyItem(tab)
    setDraft(
      tab === "stock" && presetCategory
        ? { ...base, category: inventoryCategoryLabel(presetCategory) }
        : base,
    )
    setAddScanFeedback(null)
    setAddOpen(true)
  }

  function handleAddDialogOpen(open: boolean) {
    setAddOpen(open)
    if (!open) setAddScanFeedback(null)
  }

  async function saveEmpiezaItem(item: InventoryItemRow): Promise<boolean> {
    const name = item.name.trim()
    if (!name) {
      setLoadError("El nombre es obligatorio.")
      return false
    }
    setBusyId(item.id)
    setLoadError(null)
    const ok = await saveItemFields(item.id, {
      name,
      category: inventoryCategoryLabel(item.category),
      image_url: item.image_url.trim(),
      notes: item.notes.trim(),
      quantity: Number(item.quantity) || 0,
      unit: item.unit.trim() || "kg",
      bolsas: item.bolsas,
      cantidad_num: item.cantidad_num,
      purchased: item.purchased,
    })
    setBusyId(null)
    if (!ok) await refresh()
    return ok
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as InventoryListKind)}
        className="space-y-4"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="stock">
            Inventario actual ({stockItems.length})
          </TabsTrigger>
          <TabsTrigger value="shopping">
            Lista de compras ({shoppingPending})
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "stock"
                  ? "Buscar en inventario…"
                  : "Buscar en lista de compras…"
              }
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEmpiezaOpen(true)}
            >
              Empieza
            </Button>
            <Dialog open={addOpen} onOpenChange={handleAddDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" onClick={openAddDialog}>
                  <Plus className="size-4 mr-1" />
                  {tab === "stock" ? "Agregar producto" : "Agregar a la lista"}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {tab === "stock" ? "Nuevo producto" : "Nuevo en lista de compras"}
                </DialogTitle>
                <DialogDescription>
                  {tab === "stock"
                    ? "Registra lo que tienes en cocina o almacén."
                    : "Algo que necesitas comprar o reabastecer."}
                </DialogDescription>
              </DialogHeader>
              {tab === "stock" && (
                <div className="flex flex-col items-center gap-2 pb-3 border-b">
                  <InventoryAiScanButton
                    productName={draft.name.trim() || "producto nuevo"}
                    onImageUrl={(url) =>
                      setDraft((d) => ({ ...d, image_url: url }))
                    }
                    onScanApplied={(patch, summary) => {
                      setDraft((d) => ({ ...d, ...patch }))
                      setAddScanFeedback(summary)
                      setLoadError(null)
                    }}
                    onError={(msg) => setAddScanFeedback(msg)}
                  />
                  {addScanFeedback && (
                    <p
                      className={cn(
                        "text-xs text-center max-w-sm px-2 py-1.5 rounded-md",
                        addScanFeedback.startsWith("Nombre") ||
                          addScanFeedback.startsWith("Estado") ||
                          addScanFeedback.includes("Kilos") ||
                          addScanFeedback.includes("Cantidad")
                          ? "bg-primary/10 text-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {addScanFeedback}
                    </p>
                  )}
                </div>
              )}
              <div className="grid gap-3 py-2">
                <div className="space-y-2">
                  <Label htmlFor="inv-name">Nombre</Label>
                  <Input
                    id="inv-name"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                    placeholder="Ej. Aguacate"
                  />
                </div>
                {tab === "stock" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="inv-category">Categoría</Label>
                      <Select
                        value={
                          INVENTORY_STOCK_CATEGORIES.includes(
                            draft.category as (typeof INVENTORY_STOCK_CATEGORIES)[number],
                          )
                            ? draft.category
                            : inventoryCategoryLabel(draft.category)
                        }
                        onValueChange={(value) =>
                          setDraft({ ...draft, category: value })
                        }
                      >
                        <SelectTrigger id="inv-category" className="w-full">
                          <SelectValue placeholder="Elige categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {INVENTORY_STOCK_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-status">Estado</Label>
                      <Select
                        value={
                          findStockStatusForNotes(draft.notes)?.id ??
                          INVENTORY_SELECT_NONE
                        }
                        onValueChange={(id) => {
                          if (id === INVENTORY_SELECT_NONE) {
                            setDraft({ ...draft, notes: "" })
                            return
                          }
                          const option = STOCK_STATUS_OPTIONS.find(
                            (o) => o.id === id,
                          )
                          if (!option) return
                          setDraft({ ...draft, notes: option.notes })
                        }}
                      >
                        <SelectTrigger id="inv-status" className="w-full">
                          <SelectValue placeholder={INVENTORY_SELECT_BLANK} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INVENTORY_SELECT_NONE}>
                            {INVENTORY_SELECT_BLANK}
                          </SelectItem>
                          {STOCK_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-qty">Cantidad Kilos</Label>
                      <Select
                        value={
                          findStockQuantityPresetForItem(draft)?.id ??
                          INVENTORY_SELECT_NONE
                        }
                        onValueChange={(id) => {
                          if (id === INVENTORY_SELECT_NONE) {
                            setDraft({ ...draft, quantity: 0, unit: "kg" })
                            return
                          }
                          const preset = STOCK_QUANTITY_PRESETS.find(
                            (p) => p.id === id,
                          )
                          if (!preset) return
                          setDraft({
                            ...draft,
                            quantity: preset.quantity,
                            unit: preset.unit,
                          })
                        }}
                      >
                        <SelectTrigger id="inv-qty" className="w-full">
                          <SelectValue placeholder={INVENTORY_SELECT_BLANK} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INVENTORY_SELECT_NONE}>
                            {INVENTORY_SELECT_BLANK}
                          </SelectItem>
                          {STOCK_QUANTITY_PRESETS.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-count">Cantidad</Label>
                      <Select
                        value={
                          findStockCountPresetForItem(draft)?.id ??
                          INVENTORY_SELECT_NONE
                        }
                        onValueChange={(id) => {
                          if (id === INVENTORY_SELECT_NONE) {
                            setDraft({ ...draft, cantidad_num: null })
                            return
                          }
                          const preset = STOCK_COUNT_PRESETS.find(
                            (p) => p.id === id,
                          )
                          if (!preset) return
                          setDraft({
                            ...draft,
                            cantidad_num: preset.cantidad_num,
                          })
                        }}
                      >
                        <SelectTrigger id="inv-count" className="w-full">
                          <SelectValue placeholder={INVENTORY_SELECT_BLANK} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value={INVENTORY_SELECT_NONE}>
                            {INVENTORY_SELECT_BLANK}
                          </SelectItem>
                          {STOCK_COUNT_PRESETS.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-bolsas">Bottles/Bolsas</Label>
                      <Select
                        value={
                          findStockBolsasPresetForItem(draft)?.id ??
                          INVENTORY_SELECT_NONE
                        }
                        onValueChange={(id) => {
                          if (id === INVENTORY_SELECT_NONE) {
                            setDraft({ ...draft, bolsas: null })
                            return
                          }
                          const preset = STOCK_BOLSAS_PRESETS.find(
                            (p) => p.id === id,
                          )
                          if (!preset) return
                          setDraft({ ...draft, bolsas: preset.bolsas })
                        }}
                      >
                        <SelectTrigger id="inv-bolsas" className="w-full">
                          <SelectValue placeholder={INVENTORY_SELECT_BLANK} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INVENTORY_SELECT_NONE}>
                            {INVENTORY_SELECT_BLANK}
                          </SelectItem>
                          {STOCK_BOLSAS_PRESETS.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="inv-notes">Cantidad / notas</Label>
                    <Input
                      id="inv-notes"
                      value={draft.notes}
                      onChange={(e) =>
                        setDraft({ ...draft, notes: e.target.value })
                      }
                      placeholder="Ej. 1 bag, $20, need 3"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void addItem()}>
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>

          <InventarioEmpiezaDialog
            open={empiezaOpen}
            onOpenChange={setEmpiezaOpen}
            tab={tab}
            items={filtered}
            busy={busyId != null}
            onPatch={patchLocal}
            onSaveItem={saveEmpiezaItem}
            onImageUrl={applyInventoryImage}
          />
        </div>

        <TabsContent value="stock" className="space-y-4 mt-0">
          {stockByCategory.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Inventario actual</CardTitle>
                <CardDescription>
                  Lo que tienes ahora, por categoría (tomates, especias,
                  proteínas…).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">
                  {stockItems.length === 0
                    ? "Agrega productos o corre la migración con la lista guardada."
                    : "Ningún resultado para esta búsqueda."}
                </p>
              </CardContent>
            </Card>
          ) : (
            stockByCategory.map((group) => (
              <Card key={group.category}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
                  <div className="min-w-0">
                    <CardTitle>{group.category}</CardTitle>
                    <CardDescription>
                      {group.items.length} producto
                      {group.items.length === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => openAddDialog(group.category)}
                  >
                    <Plus className="size-4 mr-1" />
                    Agregar
                  </Button>
                </CardHeader>
                <CardContent className="overflow-x-auto -mx-2 px-2">
                  <StockTable
                    items={group.items}
                    allCount={group.items.length}
                    busyId={busyId}
                    onPatch={patchLocal}
                    onSave={saveItemFields}
                    onStatus={applyStockStatus}
                    onClearStatus={clearStockStatus}
                    onQuantityPreset={applyStockQuantityPreset}
                    onClearQuantity={clearStockQuantity}
                    onCountPreset={applyStockCountPreset}
                    onClearCount={clearStockCount}
                    onBolsasPreset={applyStockBolsasPreset}
                    onClearBolsas={clearStockBolsas}
                    onImageUrl={applyInventoryImage}
                    onAiScan={(item, patch) => void applyAiScan(item, patch)}
                    onScanError={setLoadError}
                    onDelete={deleteItem}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="shopping" className="space-y-4 mt-0">
          <div className="flex items-center gap-2">
            <Switch
              id="show-purchased"
              checked={showPurchased}
              onCheckedChange={setShowPurchased}
            />
            <Label htmlFor="show-purchased" className="cursor-pointer text-sm">
              Mostrar ya comprados
            </Label>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Need to buy / restock</CardTitle>
              <CardDescription>
                {shoppingPending} pendiente{shoppingPending === 1 ? "" : "s"}. Marca
                comprado cuando lo tengas.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto -mx-2 px-2">
              <ShoppingTable
                items={filtered}
                allCount={shoppingItems.length}
                busyId={busyId}
                onPatch={patchLocal}
                onSave={saveItemFields}
                onImageUrl={applyInventoryImage}
                onDelete={deleteItem}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StockTable({
  items,
  allCount,
  busyId,
  onPatch,
  onSave,
  onStatus,
  onClearStatus,
  onQuantityPreset,
  onClearQuantity,
  onCountPreset,
  onClearCount,
  onBolsasPreset,
  onClearBolsas,
  onImageUrl,
  onAiScan,
  onScanError,
  onDelete,
}: {
  items: InventoryItemRow[]
  allCount: number
  busyId: string | null
  onPatch: (id: string, patch: Partial<InventoryItemRow>) => void
  onSave: (id: string, patch: Partial<InventoryItemRow>) => Promise<boolean>
  onStatus: (item: InventoryItemRow, option: StockStatusOption) => void
  onClearStatus: (item: InventoryItemRow) => void
  onQuantityPreset: (
    item: InventoryItemRow,
    preset: StockQuantityPreset,
  ) => void
  onClearQuantity: (item: InventoryItemRow) => void
  onCountPreset: (item: InventoryItemRow, preset: StockCountPreset) => void
  onClearCount: (item: InventoryItemRow) => void
  onBolsasPreset: (item: InventoryItemRow, preset: StockBolsasPreset) => void
  onClearBolsas: (item: InventoryItemRow) => void
  onImageUrl: (item: InventoryItemRow, imageUrl: string) => void | Promise<void>
  onAiScan: (item: InventoryItemRow, patch: Partial<InventoryItemRow>) => void
  onScanError: (message: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <Table className="table-fixed w-full max-w-4xl">
      <colgroup>
        <col className="w-11" />
        <col className="w-[9.5rem]" />
        <col className="w-[6.5rem]" />
        <col className="w-[6.5rem]" />
        <col className="w-[5.5rem]" />
        <col className="w-[6.5rem]" />
        <col className="w-12" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className="w-11" />
          <TableHead>Producto</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Cantidad Kilos</TableHead>
          <TableHead>Cantidad</TableHead>
          <TableHead>Bottles/Bolsas</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
              {allCount === 0
                ? "Agrega productos o corre la migración con la lista guardada."
                : "Ningún resultado."}
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="pr-1">
                  <div className="flex items-center gap-0.5">
                    <InventoryItemThumb
                      itemId={item.id}
                      name={item.name}
                      imageUrl={item.image_url}
                      disabled={busyId === item.id}
                      onImageUrl={(url) => void onImageUrl(item, url)}
                    />
                    <InventoryAiScanButton
                      itemId={item.id}
                      productName={item.name}
                      compact
                      disabled={busyId === item.id}
                      onImageUrl={(url) => void onImageUrl(item, url)}
                      onScanApplied={(patch) => onAiScan(item, patch)}
                      onError={onScanError}
                    />
                  </div>
                </TableCell>
                <TableCell className="pr-2">
                  <Input
                    value={item.name}
                    onChange={(e) => onPatch(item.id, { name: e.target.value })}
                    onBlur={() => {
                      const name = item.name.trim()
                      if (name) void onSave(item.id, { name })
                    }}
                    className="h-8 w-full max-w-[11rem] font-medium"
                  />
                </TableCell>
                <TableCell>
                  <StockStatusMenu
                    item={item}
                    busy={busyId === item.id}
                    onStatus={onStatus}
                    onClear={onClearStatus}
                  />
                </TableCell>
                <TableCell>
                  <StockQuantityMenu
                    item={item}
                    busy={busyId === item.id}
                    onQuantityPreset={onQuantityPreset}
                    onClear={onClearQuantity}
                  />
                </TableCell>
                <TableCell>
                  <StockCountMenu
                    item={item}
                    busy={busyId === item.id}
                    onCountPreset={onCountPreset}
                    onClear={onClearCount}
                  />
                </TableCell>
                <TableCell>
                  <StockBolsasMenu
                    item={item}
                    busy={busyId === item.id}
                    onBolsasPreset={onBolsasPreset}
                    onClear={onClearBolsas}
                  />
                </TableCell>
                <TableCell>
                  <DeleteButton
                    name={item.name}
                    busy={busyId === item.id}
                    onConfirm={() => void onDelete(item.id)}
                  />
                </TableCell>
              </TableRow>
            ))
        )}
      </TableBody>
    </Table>
  )
}

function StockStatusMenu({
  item,
  busy,
  onStatus,
  onClear,
}: {
  item: InventoryItemRow
  busy: boolean
  onStatus: (item: InventoryItemRow, option: StockStatusOption) => void
  onClear: (item: InventoryItemRow) => void
}) {
  const active = findStockStatusForNotes(item.notes)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between gap-1 px-2 text-xs font-normal"
          disabled={busy}
        >
          <span
            className={cn(
              "truncate",
              !active && "text-muted-foreground",
            )}
          >
            {active?.label ?? INVENTORY_SELECT_BLANK}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        <DropdownMenuItem onClick={() => void onClear(item)}>
          {INVENTORY_SELECT_BLANK}
          {!active && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {STOCK_QUICK_ACTIONS.map((option) => {
          const selected = stockQuickActionIsActive(item.notes, option)
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => void onStatus(item, option)}
            >
              {option.label}
              {selected && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StockQuantityMenu({
  item,
  busy,
  onQuantityPreset,
  onClear,
}: {
  item: InventoryItemRow
  busy: boolean
  onQuantityPreset: (
    item: InventoryItemRow,
    preset: StockQuantityPreset,
  ) => void
  onClear: (item: InventoryItemRow) => void
}) {
  const active = findStockQuantityPresetForItem(item)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between gap-1 px-2 text-xs font-normal"
          disabled={busy}
        >
          <span
            className={cn(
              "truncate",
              !active && "text-muted-foreground",
            )}
          >
            {active?.label ?? INVENTORY_SELECT_BLANK}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        <DropdownMenuItem onClick={() => void onClear(item)}>
          {INVENTORY_SELECT_BLANK}
          {!active && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {STOCK_QUANTITY_PRESETS.map((preset) => {
          const selected = stockQuantityPresetIsActive(item, preset)
          return (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => void onQuantityPreset(item, preset)}
            >
              {preset.label}
              {selected && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StockCountMenu({
  item,
  busy,
  onCountPreset,
  onClear,
}: {
  item: InventoryItemRow
  busy: boolean
  onCountPreset: (item: InventoryItemRow, preset: StockCountPreset) => void
  onClear: (item: InventoryItemRow) => void
}) {
  const active = findStockCountPresetForItem(item)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between gap-1 px-2 text-xs font-normal"
          disabled={busy}
        >
          <span
            className={cn(
              "truncate",
              !active && "text-muted-foreground",
            )}
          >
            {active?.label ?? INVENTORY_SELECT_BLANK}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[8rem] max-h-60 overflow-y-auto"
      >
        <DropdownMenuItem onClick={() => void onClear(item)}>
          {INVENTORY_SELECT_BLANK}
          {!active && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {STOCK_COUNT_PRESETS.map((preset) => {
          const selected = stockCountPresetIsActive(item, preset)
          return (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => void onCountPreset(item, preset)}
            >
              {preset.label}
              {selected && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StockBolsasMenu({
  item,
  busy,
  onBolsasPreset,
  onClear,
}: {
  item: InventoryItemRow
  busy: boolean
  onBolsasPreset: (item: InventoryItemRow, preset: StockBolsasPreset) => void
  onClear: (item: InventoryItemRow) => void
}) {
  const active = findStockBolsasPresetForItem(item)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between gap-1 px-2 text-xs font-normal"
          disabled={busy}
        >
          <span
            className={cn(
              "truncate",
              !active && "text-muted-foreground",
            )}
          >
            {active?.label ?? INVENTORY_SELECT_BLANK}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        <DropdownMenuItem onClick={() => void onClear(item)}>
          {INVENTORY_SELECT_BLANK}
          {!active && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {STOCK_BOLSAS_PRESETS.map((preset) => {
          const selected = stockBolsasPresetIsActive(item, preset)
          return (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => void onBolsasPreset(item, preset)}
            >
              {preset.label}
              {selected && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ShoppingTable({
  items,
  allCount,
  busyId,
  onPatch,
  onSave,
  onImageUrl,
  onDelete,
}: {
  items: InventoryItemRow[]
  allCount: number
  busyId: string | null
  onPatch: (id: string, patch: Partial<InventoryItemRow>) => void
  onSave: (id: string, patch: Partial<InventoryItemRow>) => Promise<boolean>
  onImageUrl: (item: InventoryItemRow, imageUrl: string) => void | Promise<void>
  onDelete: (id: string) => void
}) {
  return (
    <Table className="table-fixed w-full max-w-2xl">
      <colgroup>
        <col className="w-11" />
        <col className="w-10" />
        <col className="w-[10rem]" />
        <col />
        <col className="w-12" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className="w-11" />
          <TableHead className="w-10">✓</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Cantidad / notas</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
              {allCount === 0
                ? "Lista vacía — agrega artículos o corre la migración con tu lista guardada."
                : "Nada pendiente (activa «Mostrar ya comprados»)."}
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow
              key={item.id}
              className={item.purchased ? "opacity-50" : undefined}
            >
              <TableCell className="pr-1">
                <InventoryItemThumb
                  itemId={item.id}
                  name={item.name}
                  imageUrl={item.image_url}
                  disabled={busyId === item.id}
                  onImageUrl={(url) => void onImageUrl(item, url)}
                />
              </TableCell>
              <TableCell>
                <Checkbox
                  checked={item.purchased}
                  onCheckedChange={(checked) => {
                    const purchased = checked === true
                    onPatch(item.id, { purchased })
                    void onSave(item.id, { purchased })
                  }}
                />
              </TableCell>
              <TableCell className="pr-2">
                <Input
                  value={item.name}
                  onChange={(e) => onPatch(item.id, { name: e.target.value })}
                  onBlur={() => {
                    const name = item.name.trim()
                    if (name) void onSave(item.id, { name })
                  }}
                  className={`h-8 w-full max-w-[11rem] font-medium ${item.purchased ? "line-through" : ""}`}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={item.notes}
                  onChange={(e) => onPatch(item.id, { notes: e.target.value })}
                  onBlur={() => void onSave(item.id, { notes: item.notes.trim() })}
                  placeholder="Ej. 1 bag, need 3"
                  className="h-8 w-full max-w-md text-sm"
                />
              </TableCell>
              <TableCell>
                <DeleteButton
                  name={item.name}
                  busy={busyId === item.id}
                  onConfirm={() => void onDelete(item.id)}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

function DeleteButton({
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
          <AlertDialogTitle>¿Eliminar {name || "este ítem"}?</AlertDialogTitle>
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

/** @deprecated Renamed to StockStatusMenu — kept for stale dev bundles. */
function StockQuickActionMenu({
  item,
  busy,
  onQuickAction,
}: {
  item: InventoryItemRow
  busy: boolean
  onQuickAction: (item: InventoryItemRow, option: StockStatusOption) => void
}) {
  return (
    <StockStatusMenu item={item} busy={busy} onStatus={onQuickAction} />
  )
}
