"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type {
  InventoryItemRow,
  InventoryListKind,
  StockActionOption,
  StockBolsasPreset,
  StockCountPreset,
  StockMarinatedOption,
  StockQuantityPreset,
  StockStatusOption,
} from "@/lib/inventario-types"
import {
  findStockActionForValue,
  findStockBolsasPresetForItem,
  findStockCountPresetForItem,
  findStockQuantityPresetForItem,
  findStockStatusForNotes,
  categoryShowsMarinated,
  groupStockItemsByCategory,
  INVENTORY_SELECT_BLANK,
  INVENTORY_SELECT_NONE,
  inventoryCategoryLabel,
  normalizeStockCategory,
  shoppingNotesFromStock,
  stockCategoryNames,
  stockItemNeedsPurchase,
  type InventoryStockCategoryRow,
  STOCK_ACTION_OPTIONS,
  STOCK_BOLSAS_PRESETS,
  STOCK_COUNT_PRESETS,
  STOCK_MARINATED_OPTIONS,
  STOCK_QUANTITY_PRESETS,
  STOCK_QUICK_ACTIONS,
  STOCK_STATUS_OPTIONS,
  stockActionIsActive,
  stockBolsasPresetIsActive,
  stockCountPresetIsActive,
  stockMarinatedIsActive,
  stockMarinatedOptionForValue,
  stockQuickActionIsActive,
  stockQuantityPresetIsActive,
} from "@/lib/inventario-types"
import {
  emptyStockRowFromShopping,
  findInventoryByName,
  shoppingPatchFromStock,
  shouldCreateShoppingFromStock,
  shouldCreateStockFromShopping,
  stockPatchFromShopping,
} from "@/lib/inventario-sync"
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
import { InventoryCategoriesDialog } from "@/components/inventory-categories-dialog"
import {
  Check,
  ChevronDown,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react"

function normalizeItem(row: InventoryItemRow): InventoryItemRow {
  return {
    ...row,
    name: typeof row.name === "string" ? row.name : "",
    list_kind: row.list_kind === "shopping" ? "shopping" : "stock",
    image_url: typeof row.image_url === "string" ? row.image_url : "",
    category:
      typeof row.category === "string"
        ? row.category
        : row.category == null
          ? null
          : "",
    unit: typeof row.unit === "string" ? row.unit : "kg",
    notes: typeof row.notes === "string" ? row.notes : "",
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
    marinated:
      row.marinated === true
        ? true
        : row.marinated === false
          ? false
          : null,
    stock_action:
      typeof row.stock_action === "string" ? row.stock_action.trim() : "",
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

function emptyItem(
  kind: InventoryListKind,
  defaultCategory: string,
): Omit<InventoryItemRow, "id" | "created_at" | "updated_at"> {
  return {
    name: "",
    image_url: "",
    category: defaultCategory,
    unit: kind === "stock" ? "kg" : "pza",
    quantity: 0,
    bolsas: null,
    cantidad_num: null,
    marinated: null,
    stock_action: "",
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
  initialCategories,
}: {
  initialItems: InventoryItemRow[]
  initialCategories: InventoryStockCategoryRow[]
}) {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const syncGuardRef = useRef(false)
  const [items, setItems] = useState<InventoryItemRow[]>(() =>
    sortItems(initialItems),
  )
  const [categories, setCategories] = useState<InventoryStockCategoryRow[]>(() =>
    initialCategories.map(normalizeStockCategory),
  )
  const categoryNames = useMemo(
    () => stockCategoryNames(categories),
    [categories],
  )
  const defaultCategory = categoryNames[0] ?? "Otros"
  const [tab, setTab] = useState<InventoryListKind>("stock")
  const [search, setSearch] = useState("")
  const [showPurchased, setShowPurchased] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addScanFeedback, setAddScanFeedback] = useState<string | null>(null)
  const [empiezaOpen, setEmpiezaOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [draft, setDraft] = useState(() => emptyItem("stock", defaultCategory))

  useEffect(() => {
    setItems(sortItems(initialItems))
  }, [initialItems])

  useEffect(() => {
    setCategories(initialCategories.map(normalizeStockCategory))
  }, [initialCategories])

  useEffect(() => {
    setDraft(emptyItem(tab, defaultCategory))
  }, [tab, defaultCategory])

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
        (item.notes ?? "").toLowerCase().includes(q) ||
        (item.stock_action ?? "").toLowerCase().includes(q) ||
        (item.category ?? "").toLowerCase().includes(q),
    )
  }, [tabItems, search, tab, showPurchased])

  const shoppingPending = useMemo(
    () => shoppingItems.filter((i) => !i.purchased).length,
    [shoppingItems],
  )

  const stockNeedsBuy = useMemo(
    () => stockItems.filter((i) => stockItemNeedsPurchase(i)),
    [stockItems],
  )

  const stockByCategory = useMemo(
    () => groupStockItemsByCategory(filtered, categoryNames),
    [filtered, categoryNames],
  )

  const itemCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of stockItems) {
      const cat = inventoryCategoryLabel(item.category)
      counts[cat] = (counts[cat] ?? 0) + 1
    }
    return counts
  }, [stockItems])

  function handleItemsCategoryRenamed(oldName: string, newName: string) {
    setItems((prev) =>
      prev.map((row) =>
        row.list_kind === "stock" && row.category === oldName
          ? { ...row, category: newName }
          : row,
      ),
    )
  }

  function patchLocal(id: string, patch: Partial<InventoryItemRow>) {
    setItems((prev) =>
      prev.map((row) =>
        row.id === id ? normalizeItem({ ...row, ...patch }) : row,
      ),
    )
  }

  async function saveItemFields(
    id: string,
    patch: Partial<InventoryItemRow>,
    options?: { sync?: boolean },
  ) {
    const current = items.find((row) => row.id === id)
    if (!current) return false

    const priorName =
      patch.name !== undefined ? current.name : undefined

    setLoadError(null)
    const { error } = await supabase
      .from("inventory_items")
      .update(patch)
      .eq("id", id)

    if (error) {
      setLoadError(error.message)
      return false
    }
    const merged = normalizeItem({ ...current, ...patch })
    let catalogForSync: InventoryItemRow[] = []
    setItems((prev) => {
      catalogForSync = prev.map((row) => (row.id === id ? merged : row))
      return catalogForSync
    })

    if (options?.sync !== false && !syncGuardRef.current) {
      await syncLinkedPartner(merged, priorName, catalogForSync)
    }
    return true
  }

  function patchCatalogRow(
    catalog: InventoryItemRow[],
    id: string,
    patch: Partial<InventoryItemRow>,
  ): InventoryItemRow[] {
    return catalog.map((row) =>
      row.id === id ? normalizeItem({ ...row, ...patch }) : row,
    )
  }

  async function persistRowPatch(
    id: string,
    patch: Partial<InventoryItemRow>,
  ): Promise<boolean> {
    const { error } = await supabase
      .from("inventory_items")
      .update(patch)
      .eq("id", id)
    if (error) {
      setLoadError(error.message)
      return false
    }
    return true
  }

  async function syncLinkedFromStock(
    stock: InventoryItemRow,
    priorName?: string,
    catalog: InventoryItemRow[] = items,
  ): Promise<"created" | "updated" | "skipped"> {
    const lookupName = priorName ?? stock.name
    const shopping = findInventoryByName(catalog, lookupName, "shopping")

    if (shouldCreateShoppingFromStock(stock, catalog)) {
      const name = stock.name.trim()
      if (!name) return "skipped"
      const notes = shoppingNotesFromStock(stock)
      const maxOrder = catalog
        .filter((i) => i.list_kind === "shopping")
        .reduce((m, r) => Math.max(m, r.sort_order), -1)
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({
          name,
          notes,
          list_kind: "shopping",
          unit: "pza",
          quantity: 0,
          purchased: false,
          is_active: true,
          sort_order: maxOrder + 1,
          image_url: stock.image_url.trim(),
          category: "",
          stock_action: "",
          bolsas: null,
          cantidad_num: null,
          marinated: null,
          par_level: null,
        })
        .select()
        .single()
      if (error) {
        setLoadError(error.message)
        return "skipped"
      }
      if (data) {
        setItems((prev) =>
          sortItems([...prev, data as InventoryItemRow]),
        )
      }
      return "created"
    }

    const shoppingPatch = shoppingPatchFromStock(stock, shopping)
    if (shoppingPatch && shopping) {
      syncGuardRef.current = true
      try {
        const ok = await saveItemFields(shopping.id, shoppingPatch, { sync: false })
        return ok ? "updated" : "skipped"
      } finally {
        syncGuardRef.current = false
      }
    }
    return "skipped"
  }

  async function syncLinkedFromShopping(
    shopping: InventoryItemRow,
    priorName?: string,
    catalog: InventoryItemRow[] = items,
  ): Promise<"created" | "updated" | "skipped"> {
    const lookupName = priorName ?? shopping.name
    const stock = findInventoryByName(catalog, lookupName, "stock")

    if (shouldCreateStockFromShopping(shopping, catalog)) {
      const maxOrder = catalog
        .filter((i) => i.list_kind === "stock")
        .reduce((m, r) => Math.max(m, r.sort_order), -1)
      const row = emptyStockRowFromShopping(
        shopping,
        defaultCategory,
        maxOrder + 1,
      )
      const { data, error } = await supabase
        .from("inventory_items")
        .insert(row)
        .select()
        .single()
      if (error) {
        setLoadError(error.message)
        return "skipped"
      }
      if (data) {
        setItems((prev) =>
          sortItems([...prev, data as InventoryItemRow]),
        )
      }
      return "created"
    }

    const stockPatch = stockPatchFromShopping(shopping, stock)
    if (stockPatch && stock) {
      syncGuardRef.current = true
      try {
        const ok = await saveItemFields(stock.id, stockPatch, { sync: false })
        return ok ? "updated" : "skipped"
      } finally {
        syncGuardRef.current = false
      }
    }
    return "skipped"
  }

  async function syncLinkedPartner(
    source: InventoryItemRow,
    priorName?: string,
    catalog: InventoryItemRow[] = items,
  ) {
    if (syncGuardRef.current) return
    syncGuardRef.current = true
    try {
      if (source.list_kind === "stock") {
        await syncLinkedFromStock(source, priorName, catalog)
      } else {
        await syncLinkedFromShopping(source, priorName, catalog)
      }
    } finally {
      syncGuardRef.current = false
    }
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

    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
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
        marinated:
          tab === "stock" &&
          categoryShowsMarinated(draft.category, categories)
            ? draft.marinated
            : null,
        par_level: tab === "stock" ? draft.par_level : null,
        notes: draft.notes.trim(),
        stock_action: tab === "stock" ? draft.stock_action.trim() : "",
        list_kind: tab,
        purchased: false,
        is_active: true,
        sort_order: maxOrder + 1,
      })
      .select()
      .single()

    if (error) {
      setLoadError(error.message)
      return
    }

    if (data) {
      const created = normalizeItem(data as InventoryItemRow)
      const catalog = sortItems([...items, created])
      setItems(catalog)
      await syncLinkedPartner(created, undefined, catalog)
      setSyncFeedback(
        tab === "stock"
          ? `«${created.name}» agregado al inventario (enlazado con lista de compras si aplica).`
          : `«${created.name}» agregado a la lista (enlazado con inventario si aplica).`,
      )
    }

    const scrollY = window.scrollY
    setAddOpen(false)
    setDraft(emptyItem(tab))
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY)
    })
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

  async function applyStockMarinated(
    item: InventoryItemRow,
    option: StockMarinatedOption,
  ) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { marinated: option.value })
    const ok = await saveItemFields(item.id, { marinated: option.value })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function clearStockMarinated(item: InventoryItemRow) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { marinated: null })
    const ok = await saveItemFields(item.id, { marinated: null })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function applyStockCategory(item: InventoryItemRow, category: string) {
    const cat = inventoryCategoryLabel(category)
    if (item.category === cat) return
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { category: cat })
    const ok = await saveItemFields(item.id, { category: cat })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function applyStockAction(
    item: InventoryItemRow,
    option: StockActionOption,
  ) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { stock_action: option.value })
    const ok = await saveItemFields(item.id, { stock_action: option.value })
    setBusyId(null)
    if (!ok) await refresh()
  }

  async function clearStockAction(item: InventoryItemRow) {
    setBusyId(item.id)
    setLoadError(null)
    patchLocal(item.id, { stock_action: "" })
    const ok = await saveItemFields(item.id, { stock_action: "" })
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

  async function addStockItemToShopping(item: InventoryItemRow) {
    setBusyId(item.id)
    setLoadError(null)
    setSyncFeedback(null)
    const merged = normalizeItem({ ...item })
    if (!stockItemNeedsPurchase(merged)) {
      const buyNotes =
        STOCK_STATUS_OPTIONS.find((o) => o.id === "comprar_mas")?.notes ?? "Comprar más"
      const buyAction =
        STOCK_ACTION_OPTIONS.find((o) => o.id === "buy_now")?.value ?? "Comprar ahora"
      await saveItemFields(
        merged.id,
        { notes: buyNotes, stock_action: buyAction },
        { sync: true },
      )
    } else {
      await syncLinkedFromStock(merged)
    }
    setBusyId(null)
    setSyncFeedback(`«${merged.name}» enlazado con lista de compras.`)
    setTab("shopping")
  }

  async function syncStockRowInCatalog(
    stock: InventoryItemRow,
    catalog: InventoryItemRow[],
    priorName?: string,
  ): Promise<{
    result: "created" | "updated" | "marked_bought" | "skipped"
    catalog: InventoryItemRow[]
  }> {
    const lookupName = priorName ?? stock.name
    const shopping = findInventoryByName(catalog, lookupName, "shopping")

    if (shouldCreateShoppingFromStock(stock, catalog)) {
      const name = stock.name.trim()
      if (!name) return { result: "skipped", catalog }
      const notes = shoppingNotesFromStock(stock)
      const maxOrder = catalog
        .filter((i) => i.list_kind === "shopping")
        .reduce((m, r) => Math.max(m, r.sort_order), -1)
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({
          name,
          notes,
          list_kind: "shopping",
          unit: "pza",
          quantity: 0,
          purchased: false,
          is_active: true,
          sort_order: maxOrder + 1,
          image_url: stock.image_url.trim(),
          category: "",
          stock_action: "",
          bolsas: null,
          cantidad_num: null,
          marinated: null,
          par_level: null,
        })
        .select()
        .single()
      if (error || !data) {
        setLoadError(error?.message ?? "No se pudo crear en lista de compras.")
        return { result: "skipped", catalog }
      }
      return {
        result: "created",
        catalog: sortItems([...catalog, normalizeItem(data as InventoryItemRow)]),
      }
    }

    const shoppingPatch = shoppingPatchFromStock(stock, shopping)
    if (!shoppingPatch || !shopping) {
      return { result: "skipped", catalog }
    }
    const ok = await persistRowPatch(shopping.id, shoppingPatch)
    if (!ok) return { result: "skipped", catalog }
    return {
      result: shoppingPatch.purchased === true ? "marked_bought" : "updated",
      catalog: patchCatalogRow(catalog, shopping.id, shoppingPatch),
    }
  }

  async function syncShoppingRowInCatalog(
    shopping: InventoryItemRow,
    catalog: InventoryItemRow[],
    priorName?: string,
  ): Promise<{
    result: "created" | "updated" | "skipped"
    catalog: InventoryItemRow[]
  }> {
    const lookupName = priorName ?? shopping.name
    const stock = findInventoryByName(catalog, lookupName, "stock")

    if (shouldCreateStockFromShopping(shopping, catalog)) {
      const maxOrder = catalog
        .filter((i) => i.list_kind === "stock")
        .reduce((m, r) => Math.max(m, r.sort_order), -1)
      const row = emptyStockRowFromShopping(
        shopping,
        defaultCategory,
        maxOrder + 1,
      )
      const { data, error } = await supabase
        .from("inventory_items")
        .insert(row)
        .select()
        .single()
      if (error || !data) {
        setLoadError(error?.message ?? "No se pudo crear en inventario.")
        return { result: "skipped", catalog }
      }
      return {
        result: "created",
        catalog: sortItems([...catalog, normalizeItem(data as InventoryItemRow)]),
      }
    }

    const stockPatch = stockPatchFromShopping(shopping, stock)
    if (!stockPatch || !stock) {
      return { result: "skipped", catalog }
    }
    const ok = await persistRowPatch(stock.id, stockPatch)
    if (!ok) return { result: "skipped", catalog }
    return {
      result: "updated",
      catalog: patchCatalogRow(catalog, stock.id, stockPatch),
    }
  }

  /** One-click sync for rows already marked before auto-sync existed. */
  async function syncAllInventoryLinks() {
    setSyncBusy(true)
    setLoadError(null)
    setSyncFeedback(null)

    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      setLoadError(error.message)
      setSyncBusy(false)
      return
    }

    let catalog = sortItems((data ?? []) as InventoryItemRow[])
    let shopCreated = 0
    let shopUpdated = 0
    let shopBought = 0
    let stockCreated = 0
    let stockUpdated = 0

    for (const stock of catalog.filter((i) => i.list_kind === "stock")) {
      const { result, catalog: next } = await syncStockRowInCatalog(stock, catalog)
      catalog = next
      if (result === "created") shopCreated++
      else if (result === "updated") shopUpdated++
      else if (result === "marked_bought") shopBought++
    }

    for (const shopping of catalog.filter((i) => i.list_kind === "shopping")) {
      const { result, catalog: next } = await syncShoppingRowInCatalog(
        shopping,
        catalog,
      )
      catalog = next
      if (result === "created") stockCreated++
      else if (result === "updated") stockUpdated++
    }

    setItems(catalog)
    setSyncBusy(false)

    const parts: string[] = []
    if (shopCreated) {
      parts.push(
        `${shopCreated} agregado${shopCreated === 1 ? "" : "s"} a lista de compras`,
      )
    }
    if (shopUpdated) {
      parts.push(
        `${shopUpdated} actualizado${shopUpdated === 1 ? "" : "s"} en lista`,
      )
    }
    if (shopBought) {
      parts.push(
        `${shopBought} marcado${shopBought === 1 ? "" : "s"} comprado en lista`,
      )
    }
    if (stockCreated) {
      parts.push(
        `${stockCreated} agregado${stockCreated === 1 ? "" : "s"} a inventario`,
      )
    }
    if (stockUpdated) {
      parts.push(
        `${stockUpdated} actualizado${stockUpdated === 1 ? "" : "s"} en inventario`,
      )
    }
    setSyncFeedback(
      parts.length
        ? `Sincronización completa: ${parts.join("; ")}.`
        : "Nada que cambiar: revisa que Estado/Acción o la lista coincidan por nombre.",
    )
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
    setSyncFeedback(null)
    const ok = await saveItemFields(item.id, patch)
    if (ok) {
      const merged = normalizeItem({ ...item, ...patch })
      if (stockItemNeedsPurchase(merged)) {
        setSyncFeedback(
          `Inventario actualizado. «${merged.name}» sincronizado con lista de compras.`,
        )
      }
    }
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
    const base = emptyItem(tab, defaultCategory)
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
    const category = inventoryCategoryLabel(item.category)
    const ok = await saveItemFields(item.id, {
      name,
      category,
      image_url: item.image_url.trim(),
      notes: item.notes.trim(),
      quantity: Number(item.quantity) || 0,
      unit: item.unit.trim() || "kg",
      bolsas: item.bolsas,
      cantidad_num: item.cantidad_num,
      marinated: categoryShowsMarinated(category, categories)
        ? item.marinated
        : null,
      stock_action: item.stock_action.trim(),
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

      {syncFeedback && (
        <Alert>
          <AlertTitle>Inventario ↔ Lista de compras</AlertTitle>
          <AlertDescription>{syncFeedback}</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground -mt-2">
        Los productos se enlazan por nombre (mismo nombre en ambas listas). Los
        cambios nuevos se sincronizan al guardar; si ya tenías Agotado / Comprar más
        marcados antes, pulsa <strong>Sincronizar todo</strong> una vez.
      </p>

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
              disabled={syncBusy}
              onClick={() => void syncAllInventoryLinks()}
              title="Enlaza inventario y lista de compras por nombre (ambas direcciones)"
            >
              {syncBusy ? (
                <RefreshCw className="size-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="size-4 mr-1" />
              )}
              Sincronizar todo
            </Button>
            {tab === "stock" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={syncBusy}
                  onClick={() => setTab("shopping")}
                  title={`Ver lista de compras (${stockNeedsBuy.length} piden compra en inventario)`}
                >
                  <ShoppingCart className="size-4 mr-1" />
                  Ver lista
                  {shoppingPending > 0 ? ` (${shoppingPending})` : ""}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCategoriesOpen(true)}
                >
                  <FolderOpen className="size-4 mr-1" />
                  Categorías
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEmpiezaOpen(true)}
            >
              Empieza
            </Button>
            <Dialog open={addOpen} onOpenChange={handleAddDialogOpen}>
              <Button type="button" onClick={() => openAddDialog()}>
                <Plus className="size-4 mr-1" />
                {tab === "stock" ? "Agregar producto" : "Agregar a la lista"}
              </Button>
            <DialogContent
              className="max-w-md"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
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
                          categoryNames.includes(
                            inventoryCategoryLabel(draft.category),
                          )
                            ? inventoryCategoryLabel(draft.category)
                            : defaultCategory
                        }
                        onValueChange={(value) =>
                          setDraft({ ...draft, category: value })
                        }
                      >
                        <SelectTrigger id="inv-category" className="w-full">
                          <SelectValue placeholder="Elige categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryNames.map((cat) => (
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
                      <Label htmlFor="inv-action">Acción</Label>
                      <Select
                        value={
                          findStockActionForValue(draft.stock_action)?.id ??
                          INVENTORY_SELECT_NONE
                        }
                        onValueChange={(id) => {
                          if (id === INVENTORY_SELECT_NONE) {
                            setDraft({ ...draft, stock_action: "" })
                            return
                          }
                          const option = STOCK_ACTION_OPTIONS.find(
                            (o) => o.id === id,
                          )
                          if (!option) return
                          setDraft({ ...draft, stock_action: option.value })
                        }}
                      >
                        <SelectTrigger id="inv-action" className="w-full">
                          <SelectValue placeholder={INVENTORY_SELECT_BLANK} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INVENTORY_SELECT_NONE}>
                            {INVENTORY_SELECT_BLANK}
                          </SelectItem>
                          {STOCK_ACTION_OPTIONS.map((option) => (
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
                    {categoryShowsMarinated(draft.category, categories) && (
                      <div className="space-y-2">
                        <Label htmlFor="inv-marinated">Marinado</Label>
                        <Select
                          value={
                            stockMarinatedOptionForValue(draft.marinated)?.id ??
                            INVENTORY_SELECT_NONE
                          }
                          onValueChange={(id) => {
                            if (id === INVENTORY_SELECT_NONE) {
                              setDraft({ ...draft, marinated: null })
                              return
                            }
                            const option = STOCK_MARINATED_OPTIONS.find(
                              (o) => o.id === id,
                            )
                            if (!option) return
                            setDraft({ ...draft, marinated: option.value })
                          }}
                        >
                          <SelectTrigger id="inv-marinated" className="w-full">
                            <SelectValue placeholder={INVENTORY_SELECT_BLANK} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={INVENTORY_SELECT_NONE}>
                              {INVENTORY_SELECT_BLANK}
                            </SelectItem>
                            {STOCK_MARINATED_OPTIONS.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
            categoryNames={categoryNames}
            categories={categories}
            busy={busyId != null}
            onPatch={patchLocal}
            onSaveItem={saveEmpiezaItem}
            onImageUrl={applyInventoryImage}
          />

          <InventoryCategoriesDialog
            open={categoriesOpen}
            onOpenChange={setCategoriesOpen}
            categories={categories}
            itemCountByCategory={itemCountByCategory}
            onCategoriesChange={setCategories}
            onItemsCategoryRenamed={handleItemsCategoryRenamed}
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
                <CardContent className="md:overflow-x-auto md:-mx-2 md:px-2">
                  <StockTable
                    items={group.items}
                    allCount={group.items.length}
                    showMarinated={categoryShowsMarinated(
                      group.category,
                      categories,
                    )}
                    categoryNames={categoryNames}
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
                    onMarinated={applyStockMarinated}
                    onClearMarinated={clearStockMarinated}
                    onAction={applyStockAction}
                    onClearAction={clearStockAction}
                    onCategory={applyStockCategory}
                    onImageUrl={applyInventoryImage}
                    onAiScan={(item, patch) => void applyAiScan(item, patch)}
                    onAddToShopping={(item) => void addStockItemToShopping(item)}
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
            <CardContent className="md:overflow-x-auto md:-mx-2 md:px-2">
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

function InventoryCellLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "md:hidden text-xs font-medium text-muted-foreground mb-1.5 block",
        className,
      )}
    >
      {children}
    </span>
  )
}

const stockTableMobile =
  "max-md:block max-md:w-full max-md:whitespace-normal max-md:p-0 max-md:py-0.5"
const stockRowMobile =
  "max-md:flex max-md:flex-col max-md:gap-3 max-md:py-4 max-md:items-stretch"

type StockTableProps = {
  items: InventoryItemRow[]
  allCount: number
  showMarinated?: boolean
  categoryNames: string[]
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
  onMarinated: (item: InventoryItemRow, option: StockMarinatedOption) => void
  onClearMarinated: (item: InventoryItemRow) => void
  onAction: (item: InventoryItemRow, option: StockActionOption) => void
  onClearAction: (item: InventoryItemRow) => void
  onCategory: (item: InventoryItemRow, category: string) => void
  onImageUrl: (item: InventoryItemRow, imageUrl: string) => void | Promise<void>
  onAiScan: (item: InventoryItemRow, patch: Partial<InventoryItemRow>) => void
  onAddToShopping: (item: InventoryItemRow) => void
  onScanError: (message: string) => void
  onDelete: (id: string) => void
}

function StockTable({
  items,
  allCount,
  showMarinated = false,
  categoryNames,
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
  onMarinated,
  onClearMarinated,
  onAction,
  onClearAction,
  onCategory,
  onImageUrl,
  onAiScan,
  onAddToShopping,
  onScanError,
  onDelete,
}: StockTableProps) {
  const colCount = showMarinated ? 10 : 9

  return (
    <Table
      containerClassName="max-md:overflow-visible"
      className="w-full max-w-4xl md:table-fixed max-md:block"
    >
        <colgroup className="max-md:hidden">
          <col className="w-11" />
          <col className="w-[9.5rem]" />
          <col className="w-[7.5rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[5.5rem]" />
          <col className="w-[6.5rem]" />
          {showMarinated ? <col className="w-[5.5rem]" /> : null}
          <col className="w-[7rem]" />
          <col className="w-[4.5rem]" />
        </colgroup>
        <TableHeader className="max-md:hidden">
          <TableRow>
            <TableHead className="w-11" />
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Cantidad Kilos</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Bottles/Bolsas</TableHead>
            {showMarinated ? <TableHead>Marinado</TableHead> : null}
            <TableHead>Acción</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody className="max-md:block">
          {items.length === 0 ? (
            <TableRow className={stockRowMobile}>
              <TableCell
                colSpan={colCount}
                className={cn(stockTableMobile, "text-center text-muted-foreground py-10 max-md:col-span-1")}
              >
                {allCount === 0
                  ? "Agrega productos o corre la migración con la lista guardada."
                  : "Ningún resultado."}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const busy = busyId === item.id
              return (
                <TableRow key={item.id} className={stockRowMobile}>
                  <TableCell className={cn(stockTableMobile, "md:pr-1")}>
                    <InventoryCellLabel>Foto</InventoryCellLabel>
                    <InventoryItemThumb
                      itemId={item.id}
                      name={item.name}
                      imageUrl={item.image_url}
                      disabled={busy}
                      onImageUrl={(url) => void onImageUrl(item, url)}
                    />
                  </TableCell>
                  <TableCell className={cn(stockTableMobile, "md:pr-2")}>
                    <InventoryCellLabel>Producto</InventoryCellLabel>
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        onPatch(item.id, { name: e.target.value })
                      }
                      onBlur={() => {
                        const name = item.name.trim()
                        if (name) void onSave(item.id, { name })
                      }}
                      className="h-8 w-full md:max-w-[11rem] font-medium"
                    />
                  </TableCell>
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel>Categoría</InventoryCellLabel>
                    <StockCategoryMenu
                      item={item}
                      busy={busy}
                      categoryNames={categoryNames}
                      onCategory={onCategory}
                    />
                  </TableCell>
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel>Estado</InventoryCellLabel>
                    <StockStatusMenu
                      item={item}
                      busy={busy}
                      onStatus={onStatus}
                      onClear={onClearStatus}
                    />
                  </TableCell>
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel>Cantidad Kilos</InventoryCellLabel>
                    <StockQuantityMenu
                      item={item}
                      busy={busy}
                      onQuantityPreset={onQuantityPreset}
                      onClear={onClearQuantity}
                    />
                  </TableCell>
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel>Cantidad</InventoryCellLabel>
                    <StockCountMenu
                      item={item}
                      busy={busy}
                      onCountPreset={onCountPreset}
                      onClear={onClearCount}
                    />
                  </TableCell>
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel>Bottles/Bolsas</InventoryCellLabel>
                    <StockBolsasMenu
                      item={item}
                      busy={busy}
                      onBolsasPreset={onBolsasPreset}
                      onClear={onClearBolsas}
                    />
                  </TableCell>
                  {showMarinated ? (
                    <TableCell className={stockTableMobile}>
                      <InventoryCellLabel>Marinado</InventoryCellLabel>
                      <StockMarinatedMenu
                        item={item}
                        busy={busy}
                        onMarinated={onMarinated}
                        onClear={onClearMarinated}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel>Acción</InventoryCellLabel>
                    <StockActionMenu
                      item={item}
                      busy={busy}
                      onAction={onAction}
                      onClear={onClearAction}
                    />
                  </TableCell>
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel className="sr-only">Herramientas</InventoryCellLabel>
                    <div className="flex items-center gap-0.5 md:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "size-8 shrink-0",
                          stockItemNeedsPurchase(item) &&
                            "text-amber-700 dark:text-amber-400",
                        )}
                        disabled={busy}
                        title={
                          stockItemNeedsPurchase(item)
                            ? "Enviar a lista de compras"
                            : "Añadir a lista de compras (marca Estado o Acción primero)"
                        }
                        onClick={() => onAddToShopping(item)}
                      >
                        <ShoppingCart className="size-4" />
                      </Button>
                      <InventoryAiScanButton
                        itemId={item.id}
                        productName={item.name}
                        compact
                        disabled={busy}
                        onImageUrl={(url) => void onImageUrl(item, url)}
                        onScanApplied={(patch) => onAiScan(item, patch)}
                        onError={onScanError}
                      />
                      <DeleteButton
                        name={item.name}
                        busy={busy}
                        onConfirm={() => void onDelete(item.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
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

function StockCategoryMenu({
  item,
  busy,
  categoryNames,
  onCategory,
}: {
  item: InventoryItemRow
  busy: boolean
  categoryNames: string[]
  onCategory: (item: InventoryItemRow, category: string) => void
}) {
  const label = inventoryCategoryLabel(item.category)

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
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem] max-h-60 overflow-y-auto">
        {categoryNames.map((cat) => {
          const selected = inventoryCategoryLabel(item.category) === cat
          return (
            <DropdownMenuItem
              key={cat}
              onClick={() => void onCategory(item, cat)}
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

function StockActionMenu({
  item,
  busy,
  onAction,
  onClear,
}: {
  item: InventoryItemRow
  busy: boolean
  onAction: (item: InventoryItemRow, option: StockActionOption) => void
  onClear: (item: InventoryItemRow) => void
}) {
  const active = findStockActionForValue(item.stock_action)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 w-full justify-between gap-1 px-2 text-xs font-normal",
            active?.id === "buy_now" && "border-destructive/60 text-destructive",
            active?.id === "have_reserves" &&
              "border-primary/60 text-primary",
          )}
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
      <DropdownMenuContent align="start" className="min-w-[11rem]">
        <DropdownMenuItem onClick={() => void onClear(item)}>
          {INVENTORY_SELECT_BLANK}
          {!active && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {STOCK_ACTION_OPTIONS.map((option) => {
          const selected = stockActionIsActive(item.stock_action, option)
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => void onAction(item, option)}
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

function StockMarinatedMenu({
  item,
  busy,
  onMarinated,
  onClear,
}: {
  item: InventoryItemRow
  busy: boolean
  onMarinated: (item: InventoryItemRow, option: StockMarinatedOption) => void
  onClear: (item: InventoryItemRow) => void
}) {
  const active = stockMarinatedOptionForValue(item.marinated)

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
      <DropdownMenuContent align="start" className="min-w-[8rem]">
        <DropdownMenuItem onClick={() => void onClear(item)}>
          {INVENTORY_SELECT_BLANK}
          {!active && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {STOCK_MARINATED_OPTIONS.map((option) => {
          const selected = stockMarinatedIsActive(item, option)
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => void onMarinated(item, option)}
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

type ShoppingTableProps = {
  items: InventoryItemRow[]
  allCount: number
  busyId: string | null
  onPatch: (id: string, patch: Partial<InventoryItemRow>) => void
  onSave: (id: string, patch: Partial<InventoryItemRow>) => Promise<boolean>
  onImageUrl: (item: InventoryItemRow, imageUrl: string) => void | Promise<void>
  onDelete: (id: string) => void
}

function ShoppingTable({
  items,
  allCount,
  busyId,
  onPatch,
  onSave,
  onImageUrl,
  onDelete,
}: ShoppingTableProps) {
  return (
    <Table
      containerClassName="max-md:overflow-visible"
      className="w-full max-w-2xl md:table-fixed max-md:block"
    >
        <colgroup className="max-md:hidden">
          <col className="w-11" />
          <col className="w-10" />
          <col className="w-[10rem]" />
          <col />
          <col className="w-12" />
        </colgroup>
        <TableHeader className="max-md:hidden">
          <TableRow>
            <TableHead className="w-11" />
            <TableHead className="w-10">✓</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Cantidad / notas</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody className="max-md:block">
          {items.length === 0 ? (
            <TableRow className={stockRowMobile}>
              <TableCell
                colSpan={5}
                className={cn(stockTableMobile, "text-center text-muted-foreground py-10 max-md:col-span-1")}
              >
                {allCount === 0
                  ? "Lista vacía — agrega artículos o corre la migración con tu lista guardada."
                  : "Nada pendiente (activa «Mostrar ya comprados»)."}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const busy = busyId === item.id
              return (
                <TableRow
                  key={item.id}
                  className={cn(
                    stockRowMobile,
                    item.purchased && "opacity-50",
                  )}
                >
                  <TableCell className={cn(stockTableMobile, "md:pr-1")}>
                    <InventoryCellLabel>Foto</InventoryCellLabel>
                    <InventoryItemThumb
                      itemId={item.id}
                      name={item.name}
                      imageUrl={item.image_url}
                      disabled={busy}
                      onImageUrl={(url) => void onImageUrl(item, url)}
                    />
                  </TableCell>
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel>Comprado</InventoryCellLabel>
                    <Checkbox
                      checked={item.purchased}
                      disabled={busy}
                      onCheckedChange={(checked) => {
                        const purchased = checked === true
                        onPatch(item.id, { purchased })
                        void onSave(item.id, { purchased })
                      }}
                    />
                  </TableCell>
                  <TableCell className={cn(stockTableMobile, "md:pr-2")}>
                    <InventoryCellLabel>Producto</InventoryCellLabel>
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        onPatch(item.id, { name: e.target.value })
                      }
                      onBlur={() => {
                        const name = item.name.trim()
                        if (name) void onSave(item.id, { name })
                      }}
                      className={cn(
                        "h-8 w-full md:max-w-[11rem] font-medium",
                        item.purchased && "line-through",
                      )}
                    />
                  </TableCell>
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel>Cantidad / notas</InventoryCellLabel>
                    <Input
                      value={item.notes}
                      onChange={(e) =>
                        onPatch(item.id, { notes: e.target.value })
                      }
                      onBlur={() =>
                        void onSave(item.id, { notes: item.notes.trim() })
                      }
                      placeholder="Ej. 1 bag, need 3"
                      className="h-8 w-full md:max-w-md text-sm"
                    />
                  </TableCell>
                  <TableCell className={stockTableMobile}>
                    <InventoryCellLabel className="sr-only">Eliminar</InventoryCellLabel>
                    <div className="md:flex md:justify-end">
                      <DeleteButton
                        name={item.name}
                        busy={busy}
                        onConfirm={() => void onDelete(item.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
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
