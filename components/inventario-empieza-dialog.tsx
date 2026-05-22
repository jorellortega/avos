"use client"

import { useEffect, useMemo, useState } from "react"
import type { InventoryItemRow, InventoryListKind } from "@/lib/inventario-types"
import {
  findStockActionForValue,
  findStockBolsasPresetForItem,
  findStockCountPresetForItem,
  findStockQuantityPresetForItem,
  findStockStatusForNotes,
  INVENTORY_SELECT_BLANK,
  INVENTORY_SELECT_NONE,
  categoryShowsMarinated,
  inventoryCategoryLabel,
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

  const walkItems = useMemo(
    () => items.filter((i) => i.list_kind === tab),
    [items, tab],
  )

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
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {total === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No hay productos en esta lista. Agrega uno o quita el filtro de
            búsqueda.
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
                      if (option) onPatch(item.id, { notes: option.notes })
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
