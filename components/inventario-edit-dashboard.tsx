"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { InventoryItemRow, InventoryListKind } from "@/lib/inventario-types"
import { isLowStock } from "@/lib/inventario-types"
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
import { Badge } from "@/components/ui/badge"
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
import { Minus, Plus, Search, Trash2 } from "lucide-react"

function normalizeItem(row: InventoryItemRow): InventoryItemRow {
  return {
    ...row,
    list_kind: row.list_kind === "shopping" ? "shopping" : "stock",
    purchased: Boolean(row.purchased),
    quantity: Number(row.quantity) || 0,
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
    category: "",
    unit: kind === "stock" ? "pza" : "pza",
    quantity: 0,
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
  const [draft, setDraft] = useState(emptyItem("stock"))
  const qtyAtFocus = useRef<Record<string, number>>({})

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

  const lowCount = useMemo(
    () => stockItems.filter((i) => i.is_active && isLowStock(i)).length,
    [stockItems],
  )

  const shoppingPending = useMemo(
    () => shoppingItems.filter((i) => !i.purchased).length,
    [shoppingItems],
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
      category: draft.category.trim(),
      unit: draft.unit.trim() || "pza",
      quantity: tab === "stock" ? draft.quantity : 0,
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

  function openAddDialog() {
    setDraft(emptyItem(tab))
    setAddOpen(true)
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
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
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
                <div className="space-y-2">
                  <Label htmlFor="inv-notes">
                    {tab === "stock" ? "Cantidad actual" : "Cantidad / notas"}
                  </Label>
                  <Input
                    id="inv-notes"
                    value={draft.notes}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                    placeholder={
                      tab === "stock" ? "Ej. 2 kilos, full, 3 left" : "Ej. 1 bag, $20, need 3"
                    }
                  />
                </div>
                {tab === "stock" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="inv-unit">Unidad</Label>
                      <Input
                        id="inv-unit"
                        value={draft.unit}
                        onChange={(e) =>
                          setDraft({ ...draft, unit: e.target.value })
                        }
                        placeholder="kg, pza"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-par">Mínimo (alerta)</Label>
                      <Input
                        id="inv-par"
                        type="number"
                        min={0}
                        value={draft.par_level ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            par_level:
                              e.target.value === ""
                                ? null
                                : Math.max(0, Number(e.target.value)),
                          })
                        }
                        placeholder="Opcional"
                      />
                    </div>
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

        <TabsContent value="stock" className="space-y-4 mt-0">
          {lowCount > 0 && (
            <Alert>
              <AlertTitle>Stock bajo</AlertTitle>
              <AlertDescription>
                {lowCount} producto{lowCount === 1 ? "" : "s"} por debajo del mínimo.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Inventario actual</CardTitle>
              <CardDescription>
                Lo que tienes ahora. Usa + / − para ajustar cantidades numéricas.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto -mx-2 px-2">
              <StockTable
                items={filtered}
                allCount={stockItems.length}
                busyId={busyId}
                qtyAtFocus={qtyAtFocus}
                onPatch={patchLocal}
                onSave={saveItemFields}
                onAdjust={adjustQuantity}
                onDelete={deleteItem}
              />
            </CardContent>
          </Card>
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
  qtyAtFocus,
  onPatch,
  onSave,
  onAdjust,
  onDelete,
}: {
  items: InventoryItemRow[]
  allCount: number
  busyId: string | null
  qtyAtFocus: MutableRefObject<Record<string, number>>
  onPatch: (id: string, patch: Partial<InventoryItemRow>) => void
  onSave: (id: string, patch: Partial<InventoryItemRow>) => Promise<boolean>
  onAdjust: (item: InventoryItemRow, delta: number, reason: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead>Cantidad actual</TableHead>
          <TableHead className="text-center">#</TableHead>
          <TableHead className="text-center">Mín.</TableHead>
          <TableHead className="w-[52px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
              {allCount === 0
                ? "Agrega productos o corre la migración con la lista guardada."
                : "Ningún resultado."}
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => {
            const low = item.is_active && isLowStock(item)
            return (
              <TableRow
                key={item.id}
                className={low ? "bg-amber-50/80 dark:bg-amber-950/20" : undefined}
              >
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Input
                      value={item.name}
                      onChange={(e) => onPatch(item.id, { name: e.target.value })}
                      onBlur={() => {
                        const name = item.name.trim()
                        if (name) void onSave(item.id, { name })
                      }}
                      className="h-8 font-medium"
                    />
                    {low && (
                      <Badge variant="outline" className="w-fit text-amber-700">
                        Stock bajo
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    value={item.notes}
                    onChange={(e) => onPatch(item.id, { notes: e.target.value })}
                    onBlur={() => void onSave(item.id, { notes: item.notes.trim() })}
                    placeholder="Ej. 1 kilo, full"
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={busyId === item.id || item.quantity <= 0}
                      onClick={() => void onAdjust(item, -1, "Ajuste manual")}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onFocus={() => {
                        qtyAtFocus.current[item.id] = Number(item.quantity)
                      }}
                      onChange={(e) =>
                        onPatch(item.id, {
                          quantity: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      onBlur={async () => {
                        const q = Math.max(0, Number(item.quantity))
                        const prev = qtyAtFocus.current[item.id] ?? q
                        if (q !== prev) void onAdjust(item, q - prev, "Corrección manual")
                      }}
                      className="h-8 w-16 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={busyId === item.id}
                      onClick={() => void onAdjust(item, 1, "Ajuste manual")}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    value={item.par_level ?? ""}
                    onChange={(e) =>
                      onPatch(item.id, {
                        par_level:
                          e.target.value === ""
                            ? null
                            : Math.max(0, Number(e.target.value)),
                      })
                    }
                    onBlur={() => void onSave(item.id, { par_level: item.par_level })}
                    className="h-8 w-16 text-center mx-auto"
                    placeholder="—"
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
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

function ShoppingTable({
  items,
  allCount,
  busyId,
  onPatch,
  onSave,
  onDelete,
}: {
  items: InventoryItemRow[]
  allCount: number
  busyId: string | null
  onPatch: (id: string, patch: Partial<InventoryItemRow>) => void
  onSave: (id: string, patch: Partial<InventoryItemRow>) => Promise<boolean>
  onDelete: (id: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">✓</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Cantidad / notas</TableHead>
          <TableHead className="w-[52px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
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
              <TableCell>
                <Input
                  value={item.name}
                  onChange={(e) => onPatch(item.id, { name: e.target.value })}
                  onBlur={() => {
                    const name = item.name.trim()
                    if (name) void onSave(item.id, { name })
                  }}
                  className={`h-8 font-medium ${item.purchased ? "line-through" : ""}`}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={item.notes}
                  onChange={(e) => onPatch(item.id, { notes: e.target.value })}
                  onBlur={() => void onSave(item.id, { notes: item.notes.trim() })}
                  placeholder="Ej. 1 bag, need 3"
                  className="h-8 text-sm"
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
