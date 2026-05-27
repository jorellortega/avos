"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff, Loader2, Minus, Plus, Pencil, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import {
  bebidaTamanoLabels,
  bebidas,
  proteinas,
  type BebidaTamano,
  type Proteina,
} from "@/lib/menu-data"
import type { PortalOrderLineBreakdown } from "@/lib/portal-menu-snapshot"
import type { OrderType } from "@/components/orders-provider"
import { PortalDomicilioDelivery } from "@/components/portal/portal-domicilio-delivery"
import { PortalOrderTipoPicker } from "@/components/portal/portal-order-tipo-picker"
import type { PortalDeliveryInfo } from "@/lib/portal-delivery"
import {
  parseCartLineBaseId,
  type PortalCartItemUpdate,
} from "@/lib/portal-cart-item"
import { cn } from "@/lib/utils"
import { formatPortalOrderSpeechText } from "@/lib/portal-order-speech"
import { PortalOrderPlayback } from "@/components/portal/portal-order-playback"
import { PortalCashChange } from "@/components/portal/portal-cash-change"

type PortalAiOrderReplyProps = {
  lines: PortalOrderLineBreakdown[]
  total: number
  orderNumero?: number
  warnings?: string
  onUpdateItem?: (itemId: string, update: PortalCartItemUpdate) => void
  onDeleteItem?: (itemId: string) => void
  onAddItem?: () => void
  onAiCustomize?: (
    itemId: string,
    instruction: string,
  ) => Promise<{ notas: string } | { error: string }>
  itemFixItemId?: string | null
  onItemFixHandled?: () => void
  orderTipo?: OrderType
  onOrderTipoChange?: (tipo: OrderType) => void
  delivery?: PortalDeliveryInfo
  needsDelivery?: boolean
  onDeliverySave?: (delivery: PortalDeliveryInfo) => void
}

export function PortalAiOrderReply({
  lines,
  total,
  orderNumero,
  warnings,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onAiCustomize,
  itemFixItemId,
  onItemFixHandled,
  orderTipo = "mesa",
  onOrderTipoChange,
  delivery = {},
  needsDelivery = false,
  onDeliverySave,
}: PortalAiOrderReplyProps) {
  const { catalog } = useMenuCatalogContext()
  const [showLinePrices, setShowLinePrices] = useState(false)
  const [editing, setEditing] = useState<PortalOrderLineBreakdown | null>(null)
  const [editQty, setEditQty] = useState(1)
  const [editProteina, setEditProteina] = useState<Proteina | undefined>()
  const [editBebidaTamano, setEditBebidaTamano] = useState<BebidaTamano | undefined>()
  const [editBebidaId, setEditBebidaId] = useState<string | undefined>()
  const [fixOnly, setFixOnly] = useState(false)
  const [customizing, setCustomizing] = useState<PortalOrderLineBreakdown | null>(
    null,
  )
  const [customizeInput, setCustomizeInput] = useState("")
  const [customizeLoading, setCustomizeLoading] = useState(false)
  const [customizeError, setCustomizeError] = useState<string | null>(null)

  const canEdit = Boolean(onUpdateItem && onDeleteItem)
  const canAiCustomize = Boolean(onAiCustomize)
  const speechText = formatPortalOrderSpeechText({
    orderNumero,
    lines,
    total,
    orderTipo,
    delivery,
  })
  const hasIncomplete = lines.some(
    (l) => l.needsProteina || l.needsBebidaTamano || l.needsBebidaEleccion,
  )

  const lineNeedsFix = (line: PortalOrderLineBreakdown) =>
    line.needsProteina || line.needsBebidaTamano || line.needsBebidaEleccion

  const openCustomize = (line: PortalOrderLineBreakdown) => {
    setCustomizing(line)
    setCustomizeInput("")
    setCustomizeError(null)
  }

  const submitCustomize = async () => {
    if (!customizing || !onAiCustomize) return
    const instruction = customizeInput.trim()
    if (!instruction) {
      setCustomizeError("Escribe la personalización.")
      return
    }
    setCustomizeLoading(true)
    setCustomizeError(null)
    try {
      const result = await onAiCustomize(customizing.id, instruction)
      if ("error" in result) {
        setCustomizeError(result.error)
        return
      }
      setCustomizing(null)
      setCustomizeInput("")
    } catch {
      setCustomizeError("Error de red.")
    } finally {
      setCustomizeLoading(false)
    }
  }

  const openEdit = (line: PortalOrderLineBreakdown, onlyFix = false) => {
    setEditing(line)
    setEditQty(line.cantidad)
    setEditProteina(line.proteina)
    setEditBebidaTamano(undefined)
    setEditBebidaId(line.bebidaId)
    setFixOnly(onlyFix)
  }

  useEffect(() => {
    if (!itemFixItemId) return
    const line = lines.find((l) => l.id === itemFixItemId)
    if (line && lineNeedsFix(line)) {
      openEdit(line, true)
    }
    onItemFixHandled?.()
  }, [itemFixItemId, lines, onItemFixHandled])

  const saveEdit = () => {
    if (!editing || !onUpdateItem) return
    const qty = Math.max(1, Math.min(99, editQty))
    if (editing.needsBebidaEleccion) {
      if (!editBebidaId) return
      onUpdateItem(editing.id, {
        cantidad: fixOnly ? editing.cantidad : qty,
        bebidaId: editBebidaId,
        ...(editBebidaTamano ? { bebidaTamano: editBebidaTamano } : {}),
      })
    } else if (editing.needsBebidaTamano) {
      if (!editBebidaTamano) return
      onUpdateItem(editing.id, {
        cantidad: fixOnly ? editing.cantidad : qty,
        bebidaTamano: editBebidaTamano,
      })
    } else {
      const needsProtein = editing.needsProteina || editing.tieneProteinas
      if (needsProtein && !editProteina) return
      onUpdateItem(editing.id, {
        cantidad: fixOnly ? editing.cantidad : qty,
        ...(needsProtein && editProteina ? { proteina: editProteina } : {}),
      })
    }
    setEditing(null)
    setFixOnly(false)
  }

  const renderLineBody = (line: PortalOrderLineBreakdown) => (
    <>
      <span
        className={cn(
          lineNeedsFix(line) && "text-destructive font-medium",
        )}
      >
        {line.cantidad}× {line.nombre}
        {line.notas ? (
          <span className="text-muted-foreground font-normal"> ({line.notas})</span>
        ) : null}
      </span>
      {line.needsProteina && (
        <span className="block text-xs text-destructive mt-0.5">Toca para elegir proteína</span>
      )}
      {line.needsBebidaTamano && (
        <span className="block text-xs text-destructive mt-0.5">Toca para elegir tamaño</span>
      )}
      {line.needsBebidaEleccion && (
        <span className="block text-xs text-destructive mt-0.5">Toca para elegir bebida</span>
      )}
      {showLinePrices && !lineNeedsFix(line) && (
        <span className="text-muted-foreground">
          {" "}
          —{" "}
          {line.cantidad > 1
            ? `$${line.precio.toFixed(0)} × ${line.cantidad} = $${line.subtotal.toFixed(0)}`
            : `$${line.subtotal.toFixed(0)}`}
        </span>
      )}
    </>
  )

  const editDialogTitle = !editing
    ? "Editar artículo"
    : editing.needsBebidaEleccion
      ? "Elegir bebida"
      : editing.needsBebidaTamano
      ? editing.nombre.replace(/\s*\(elige tamaño\)/i, "").trim() || "Elegir tamaño"
      : editing.needsProteina || (fixOnly && editing.tieneProteinas)
        ? editing.nombre.replace(/\s*\(elige proteína\)/i, "").trim() || "Elegir proteína"
        : editing.tieneProteinas && editing.proteina
          ? editing.nombre.replace(/\s+de\s+\S+$/i, "").trim() || editing.nombre
          : editing.nombre

  const editDialogDescription = !editing
    ? ""
    : editing.needsBebidaEleccion
      ? "Selecciona qué bebida es."
      : editing.needsBebidaTamano
      ? "Selecciona chico o grande para esta bebida."
      : editing.needsProteina
        ? "Selecciona la proteína para este platillo."
        : "Ajusta la cantidad u opciones del artículo."

  const showProteinPicker =
    editing &&
    !editing.needsBebidaTamano &&
    !editing.needsBebidaEleccion &&
    (editing.needsProteina || editing.tieneProteinas || fixOnly)

  const showTamanoPicker = editing?.needsBebidaTamano
  const showBebidaPicker = editing?.needsBebidaEleccion

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium pt-1">Has pedido:</p>
        <div className="flex items-center gap-1 shrink-0">
          <PortalOrderPlayback text={speechText} />
          {canEdit && onAddItem && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Agregar otro artículo"
              aria-label="Agregar otro artículo"
              onClick={onAddItem}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {hasIncomplete && (
        <p className="text-xs text-destructive font-medium">
          En rojo: falta proteína o tamaño de bebida — toca la línea para corregir
        </p>
      )}
      <ul className="space-y-0.5 text-sm">
        {lines.map((line) =>
          canEdit ? (
            <li key={line.id}>
              {lineNeedsFix(line) ? (
                <button
                  type="button"
                  onClick={() => openEdit(line, true)}
                  className="w-full text-left rounded-md px-2 py-1.5 -mx-2 border border-destructive/50 bg-destructive/10 hover:bg-destructive/15 transition-colors cursor-pointer"
                >
                  {renderLineBody(line)}
                </button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full text-left rounded-md px-2 py-1 -mx-2 hover:bg-muted/80 active:bg-muted transition-colors cursor-pointer"
                    >
                      {renderLineBody(line)}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuItem onClick={() => openEdit(line)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    {canAiCustomize && (
                      <DropdownMenuItem onClick={() => openCustomize(line)}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Personalizar (IA)
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDeleteItem?.(line.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ) : (
            <li
              key={line.id}
              className={cn("px-2 py-1 -mx-2", lineNeedsFix(line) && "text-destructive")}
            >
              {renderLineBody(line)}
            </li>
          ),
        )}
      </ul>
      {onOrderTipoChange && (
        <PortalOrderTipoPicker
          variant="inline"
          value={orderTipo}
          onChange={onOrderTipoChange}
          className="pt-1"
        />
      )}
      {orderTipo === "domicilio" && onDeliverySave && (
        <PortalDomicilioDelivery
          delivery={delivery}
          needsDelivery={needsDelivery}
          onSave={onDeliverySave}
        />
      )}
      <p className="text-sm font-semibold pt-0.5">
        Total: ${total.toFixed(2)} MXN
        {orderTipo === "domicilio" && delivery.deliveryFee != null && delivery.deliveryFee > 0 ? (
          <span className="block text-xs font-normal text-muted-foreground">
            Incluye envío ${delivery.deliveryFee.toFixed(2)}
          </span>
        ) : null}
        {hasIncomplete && (
          <span className="text-xs font-normal text-destructive block">
            Incluye precios base; corrige líneas en rojo
          </span>
        )}
      </p>

      <PortalCashChange
        total={total}
        className="pt-2 border-t border-border/60"
      />

      {warnings && (
        <p className="text-xs text-amber-700 dark:text-amber-400">⚠ {warnings}</p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground -ml-2"
        onClick={() => setShowLinePrices((v) => !v)}
      >
        {showLinePrices ? (
          <>
            <EyeOff className="h-3.5 w-3.5 mr-1" aria-hidden />
            Ocultar precios
          </>
        ) : (
          <>
            <Eye className="h-3.5 w-3.5 mr-1" aria-hidden />
            Ver precios
          </>
        )}
      </Button>

      {customizing ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setCustomizing(null)
              setCustomizeInput("")
              setCustomizeError(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base pr-6">
                Personalizar con IA
              </DialogTitle>
              <DialogDescription>
                {customizing.cantidad}× {customizing.nombre}
                {customizing.notas
                  ? ` — notas actuales: ${customizing.notas}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Textarea
                value={customizeInput}
                onChange={(e) => setCustomizeInput(e.target.value)}
                placeholder='Ej: sin salsa, plain, sin cebolla, extra limón'
                rows={3}
                disabled={customizeLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void submitCustomize()
                  }
                }}
              />
              {customizeError && (
                <p className="text-xs text-destructive" role="alert">
                  {customizeError}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={customizeLoading}
                onClick={() => {
                  setCustomizing(null)
                  setCustomizeInput("")
                  setCustomizeError(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={customizeLoading || !customizeInput.trim()}
                onClick={() => void submitCustomize()}
              >
                {customizeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aplicando…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Aplicar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {editing ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null)
              setFixOnly(false)
            }
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base pr-6">{editDialogTitle}</DialogTitle>
              <DialogDescription>{editDialogDescription}</DialogDescription>
            </DialogHeader>

            {showBebidaPicker && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  Elige bebida (requerido)
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                  {bebidas.map((b) => {
                    if (catalog?.isBebidaOut(b.id) || catalog?.isBebidaHidden(b.id)) {
                      return null
                    }
                    const selected = editBebidaId === b.id
                    return (
                      <Button
                        key={b.id}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        className={cn(
                          "h-10 justify-start",
                          selected && "ring-2 ring-primary ring-offset-2",
                          !selected && "border-destructive/40",
                        )}
                        onClick={() => setEditBebidaId(b.id)}
                      >
                        {b.nombre}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}

            {showTamanoPicker && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">
                Elige tamaño (requerido)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["chico", "grande"] as const).map((tam) => {
                  const bebidaId = editing.bebidaId
                  if (
                    bebidaId &&
                    catalog?.isBebidaOut(bebidaId)
                  ) {
                    return null
                  }
                  const selected = editBebidaTamano === tam
                  return (
                    <Button
                      key={tam}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className={cn(
                        "h-10",
                        selected && "ring-2 ring-primary ring-offset-2",
                        !selected && "border-destructive/40",
                      )}
                      onClick={() => setEditBebidaTamano(tam)}
                    >
                      {bebidaTamanoLabels[tam]}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {showProteinPicker && (
            <div className="space-y-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  editing?.needsProteina ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {editing?.needsProteina ? "Elige proteína (requerido)" : "Proteína"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {proteinas.map((p) => {
                  const base = editing ? parseCartLineBaseId(editing.id) : null
                  if (
                    base &&
                    (catalog?.isProteinaOut(base.categoriaId, p, base.platilloId) ||
                      catalog?.isProteinaHidden(base.categoriaId, p, base.platilloId))
                  ) {
                    return null
                  }
                  const selected = editProteina === p
                  return (
                    <Button
                      key={p}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className={cn(
                        "h-10",
                        selected && "ring-2 ring-primary ring-offset-2",
                        editing?.needsProteina &&
                          !selected &&
                          "border-destructive/40",
                      )}
                      onClick={() => setEditProteina(p)}
                    >
                      {p}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {!fixOnly && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Cantidad</p>
              <div className="flex items-center justify-center gap-4 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={editQty <= 1}
                  onClick={() => setEditQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-3xl font-bold tabular-nums w-12 text-center">
                  {editQty}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={editQty >= 99}
                  onClick={() => setEditQty((q) => Math.min(99, q + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(null)
                setFixOnly(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={saveEdit}
              disabled={
                (showBebidaPicker && !editBebidaId) ||
                (showProteinPicker && !editProteina) ||
                (showTamanoPicker && !editBebidaTamano)
              }
            >
              Guardar
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
