"use client"

import { useEffect, useMemo, useState } from "react"
import type { InventoryItemRow, InventoryListKind } from "@/lib/inventario-types"
import {
  findStockActionForValue,
  findStockBolsasPresetForItem,
  findStockCountPresetForItem,
  findStockQuantityPresetForItem,
  findStockStatusForNotes,
  INVENTORY_PAR_PERIOD_OPTIONS,
  INVENTORY_PAR_UNIT_OPTIONS,
  INVENTORY_SELECT_BLANK,
  INVENTORY_SELECT_NONE,
  categoryShowsMarinated,
  groupStockItemsByCategory,
  inventoryCategoryLabel,
  formatInventoryPriceRange,
  normalizeInventoryParPeriod,
  normalizeInventoryParUnit,
  parseInventoryPriceInput,
  patchForStockStatusOption,
  stockParGap,
  type InventoryStockCategoryRow,
  STOCK_ACTION_OPTIONS,
  STOCK_BOLSAS_PRESETS,
  STOCK_COUNT_PRESETS,
  STOCK_MARINATED_OPTIONS,
  STOCK_QUANTITY_PRESETS,
  STOCK_STATUS_OPTIONS,
  stockMarinatedOptionForValue,
} from "@/lib/inventario-types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InventoryAiScanButton } from "@/components/inventory-ai-scan-button"
import { InventoryItemThumb } from "@/components/inventory-item-thumb"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: InventoryListKind
  items: InventoryItemRow[]
  categoryNames: string[]
  categories: InventoryStockCategoryRow[]
  busy: boolean
  onPatch: (id: string, patch: Partial<InventoryItemRow>) => void
  onSaveItem: (item: InventoryItemRow) => Promise<boolean>
  onImageUrl: (item: InventoryItemRow, imageUrl: string) => void | Promise<void>
}

export function InventarioEmpiezaDialog({
  open,
  onOpenChange,
  tab,
  items,
  categoryNames,
  categories,
  busy,
  onPatch,
  onSaveItem,
  onImageUrl,
}: Props) {
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<string | null>(null)

  const walkItems = useMemo(() => {
    if (tab === "stock") {
      return groupStockItemsByCategory(
        items.filter((i) => i.list_kind === "stock"),
        categoryNames,
      ).flatMap((group) => group.items)
    }
    return items.filter((i) => i.list_kind === "shopping" && !i.purchased)
  }, [items, tab, categoryNames])

  const total = walkItems.length
  const item = walkItems[index]
  const atStart = index <= 0
  const atEnd = index >= total - 1

  useEffect(() => {
    if (open) {
      setIndex(0)
      setScanFeedback(null)
    }
  }, [open, tab])

  useEffect(() => {
    setScanFeedback(null)
  }, [index])

  useEffect(() => {
    if (index >= total && total > 0) setIndex(total - 1)
  }, [index, total])

  async function saveCurrent(): Promise<boolean> {
    if (!item) return true
    setSaving(true)
    const ok = await onSaveItem(item)
    setSaving(false)
    return ok
  }

  async function handleSave() {
    await saveCurrent()
  }

  async function handleBack() {
    if (!item || atStart) return
    const ok = await saveCurrent()
    if (!ok) return
    setIndex((i) => Math.max(0, i - 1))
  }

  async function handleNext() {
    if (!item) return
    const ok = await saveCurrent()
    if (!ok) return
    if (atEnd) {
      onOpenChange(false)
      return
    }
    setIndex((i) => Math.min(i + 1, total - 1))
  }

  const disabled = busy || saving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Empieza</DialogTitle>
          <DialogDescription>
            {tab === "stock"
              ? "Revisa y actualiza cada producto del inventario."
              : "Revisa cada artículo de la lista de compras."}
            {total > 0 && (
              <span className="block mt-1 font-medium text-foreground">
                {index + 1} de {total}
                {tab === "stock" && item ? (
                  <> · {inventoryCategoryLabel(item.category)}</>
                ) : null}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {total === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No hay productos en esta lista.
          </p>
        ) : item ? (
          <div className="px-6 py-4 space-y-5 max-h-[min(70vh,32rem)] overflow-y-auto">
            <div className="flex flex-col items-center gap-3">
              <InventoryItemThumb
                key={item.id}
                itemId={item.id}
                name={item.name}
                imageUrl={item.image_url}
                disabled={disabled}
                size="lg"
                onImageUrl={(url) => void onImageUrl(item, url)}
              />
              {tab === "stock" && (
                <InventoryAiScanButton
                  itemId={item.id}
                  productName={item.name}
                  disabled={disabled}
                  onImageUrl={(url) => void onImageUrl(item, url)}
                  onScanApplied={(patch, summary) => {
                    onPatch(item.id, patch)
                    setScanFeedback(summary)
                    void onSaveItem({ ...item, ...patch })
                  }}
                  onError={(msg) => setScanFeedback(msg)}
                />
              )}
              {scanFeedback && (
                <p
                  className={cn(
                    "text-xs text-center max-w-sm px-2 py-1.5 rounded-md",
                    scanFeedback.startsWith("Estado") ||
                      scanFeedback.includes("Kilos") ||
                      scanFeedback.includes("Cantidad")
                      ? "bg-primary/10 text-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {scanFeedback}
                </p>
              )}
              <p className="text-lg font-semibold text-center leading-tight">
                {item.name || "Sin nombre"}
              </p>
              {tab === "stock" && (
                <p className="text-sm text-muted-foreground text-center">
                  {inventoryCategoryLabel(item.category)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="empieza-name">Producto</Label>
              <Input
                id="empieza-name"
                value={item.name}
                disabled={disabled}
                onChange={(e) => onPatch(item.id, { name: e.target.value })}
                placeholder="Nombre del producto"
              />
            </div>

            {tab === "stock" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Categoría</Label>
                  <Select
                    disabled={disabled}
                    value={inventoryCategoryLabel(item.category)}
                    onValueChange={(value) =>
                      onPatch(item.id, { category: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
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
                <div className="space-y-2 sm:col-span-2">
                  <Label>Estado</Label>
                  <Select
                    disabled={disabled}
                    value={
                      findStockStatusForNotes(item.notes)?.id ??
                      INVENTORY_SELECT_NONE
                    }
                    onValueChange={(id) => {
                      if (id === INVENTORY_SELECT_NONE) {
                        onPatch(item.id, { notes: "" })
                        return
                      }
                      const option = STOCK_STATUS_OPTIONS.find((o) => o.id === id)
                      if (option) {
                        onPatch(item.id, patchForStockStatusOption(option))
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
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

                <div className="space-y-2 sm:col-span-2">
                  <Label>Acción</Label>
                  <Select
                    disabled={disabled}
                    value={
                      findStockActionForValue(item.stock_action)?.id ??
                      INVENTORY_SELECT_NONE
                    }
                    onValueChange={(id) => {
                      if (id === INVENTORY_SELECT_NONE) {
                        onPatch(item.id, { stock_action: "" })
                        return
                      }
                      const option = STOCK_ACTION_OPTIONS.find((o) => o.id === id)
                      if (option) {
                        onPatch(item.id, { stock_action: option.value })
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
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
                  <Label>Cantidad Kilos</Label>
                  <Select
                    disabled={disabled}
                    value={
                      findStockQuantityPresetForItem(item)?.id ??
                      INVENTORY_SELECT_NONE
                    }
                    onValueChange={(id) => {
                      if (id === INVENTORY_SELECT_NONE) {
                        onPatch(item.id, { quantity: 0, unit: "kg" })
                        return
                      }
                      const preset = STOCK_QUANTITY_PRESETS.find((p) => p.id === id)
                      if (preset) {
                        onPatch(item.id, {
                          quantity: preset.quantity,
                          unit: preset.unit,
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
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
                  <Label>Cantidad</Label>
                  <Select
                    disabled={disabled}
                    value={
                      findStockCountPresetForItem(item)?.id ??
                      INVENTORY_SELECT_NONE
                    }
                    onValueChange={(id) => {
                      if (id === INVENTORY_SELECT_NONE) {
                        onPatch(item.id, { cantidad_num: null })
                        return
                      }
                      const preset = STOCK_COUNT_PRESETS.find((p) => p.id === id)
                      if (preset) {
                        onPatch(item.id, { cantidad_num: preset.cantidad_num })
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
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

                <div className="space-y-2 sm:col-span-2">
                  <Label>Bottles/Bolsas</Label>
                  <Select
                    disabled={disabled}
                    value={
                      findStockBolsasPresetForItem(item)?.id ??
                      INVENTORY_SELECT_NONE
                    }
                    onValueChange={(id) => {
                      if (id === INVENTORY_SELECT_NONE) {
                        onPatch(item.id, { bolsas: null })
                        return
                      }
                      const preset = STOCK_BOLSAS_PRESETS.find((p) => p.id === id)
                      if (preset) onPatch(item.id, { bolsas: preset.bolsas })
                    }}
                  >
                    <SelectTrigger className="w-full">
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

                {categoryShowsMarinated(item.category, categories) && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Marinado</Label>
                    <Select
                      disabled={disabled}
                      value={
                        stockMarinatedOptionForValue(item.marinated)?.id ??
                        INVENTORY_SELECT_NONE
                      }
                      onValueChange={(id) => {
                        if (id === INVENTORY_SELECT_NONE) {
                          onPatch(item.id, { marinated: null })
                          return
                        }
                        const option = STOCK_MARINATED_OPTIONS.find(
                          (o) => o.id === id,
                        )
                        if (option) {
                          onPatch(item.id, { marinated: option.value })
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
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

                <div className="space-y-2 sm:col-span-2 border-t border-border pt-3">
                  <Label>Meta (día o semana)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={item.par_unit === "kg" ? 0.25 : 1}
                      disabled={disabled}
                      placeholder="Cantidad"
                      value={
                        item.par_level != null ? String(item.par_level) : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value.trim()
                        const n = raw === "" ? null : Number(raw)
                        onPatch(item.id, {
                          par_level:
                            n == null || Number.isNaN(n)
                              ? null
                              : Math.max(0, n),
                        })
                      }}
                    />
                    <Select
                      disabled={disabled}
                      value={item.par_period ?? INVENTORY_SELECT_NONE}
                      onValueChange={(id) => {
                        onPatch(item.id, {
                          par_period:
                            id === INVENTORY_SELECT_NONE
                              ? null
                              : normalizeInventoryParPeriod(id),
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Periodo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={INVENTORY_SELECT_NONE}>
                          {INVENTORY_SELECT_BLANK}
                        </SelectItem>
                        {INVENTORY_PAR_PERIOD_OPTIONS.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      disabled={disabled}
                      value={item.par_unit ?? INVENTORY_SELECT_NONE}
                      onValueChange={(id) => {
                        onPatch(item.id, {
                          par_unit:
                            id === INVENTORY_SELECT_NONE
                              ? null
                              : normalizeInventoryParUnit(id),
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={INVENTORY_SELECT_NONE}>
                          {INVENTORY_SELECT_BLANK}
                        </SelectItem>
                        {INVENTORY_PAR_UNIT_OPTIONS.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {stockParGap(item) ? (
                    <p className="text-xs text-amber-700">
                      Faltan {stockParGap(item)!.gap}{" "}
                      {stockParGap(item)!.unitLabel.toLowerCase()} para la meta
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="empieza-buy-note">Nota compra</Label>
                  <Input
                    id="empieza-buy-note"
                    value={item.buy_note ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      onPatch(item.id, { buy_note: e.target.value })
                    }
                    placeholder="Ej. marca, proveedor, Costco — aparece en lista de compras"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2 border-t border-border pt-3">
                  <Label>Precio (MXN)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={disabled}
                      placeholder="Desde"
                      value={
                        item.price_min != null ? String(item.price_min) : ""
                      }
                      onChange={(e) => {
                        onPatch(item.id, {
                          price_min: parseInventoryPriceInput(e.target.value),
                        })
                      }}
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={disabled}
                      placeholder="Hasta (opc.)"
                      value={
                        item.price_max != null ? String(item.price_max) : ""
                      }
                      onChange={(e) => {
                        onPatch(item.id, {
                          price_max: parseInventoryPriceInput(e.target.value),
                        })
                      }}
                    />
                  </div>
                  {formatInventoryPriceRange(item) ? (
                    <p className="text-xs text-muted-foreground">
                      {formatInventoryPriceRange(item)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="empieza-purchased"
                    checked={item.purchased}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      onPatch(item.id, { purchased: checked === true })
                    }
                  />
                  <Label htmlFor="empieza-purchased" className="cursor-pointer">
                    Ya comprado
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="empieza-notes">Cantidad / notas</Label>
                  <Input
                    id="empieza-notes"
                    value={item.notes}
                    disabled={disabled}
                    onChange={(e) => onPatch(item.id, { notes: e.target.value })}
                    placeholder="Ej. 1 bag, $20, need 3"
                  />
                </div>
                <div className="space-y-2 border-t border-border pt-3">
                  <Label>Precio (MXN)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={disabled}
                      placeholder="Desde"
                      value={
                        item.price_min != null ? String(item.price_min) : ""
                      }
                      onChange={(e) => {
                        onPatch(item.id, {
                          price_min: parseInventoryPriceInput(e.target.value),
                        })
                      }}
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={disabled}
                      placeholder="Hasta (opc.)"
                      value={
                        item.price_max != null ? String(item.price_max) : ""
                      }
                      onChange={(e) => {
                        onPatch(item.id, {
                          price_max: parseInventoryPriceInput(e.target.value),
                        })
                      }}
                    />
                  </div>
                  {formatInventoryPriceRange(item) ? (
                    <p className="text-xs text-muted-foreground">
                      {formatInventoryPriceRange(item)}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}

        <DialogFooter className="px-6 py-4 border-t flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || atStart || total === 0}
            onClick={() => void handleBack()}
          >
            {saving ? "Guardando…" : "Atrás"}
          </Button>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={disabled || !item}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              disabled={disabled || total === 0}
              onClick={() => void handleNext()}
            >
              {saving ? "Guardando…" : atEnd ? "Listo" : "Siguiente"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
