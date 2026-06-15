"use client"

import { useState } from "react"
import { Loader2, Minus, Plus } from "lucide-react"
import { parsePortalExtraChargeInput } from "@/components/portal/portal-extra-charge"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import {
  type RegisterFloatAdjustment,
  formatCajaMoney,
  staffApplyRegisterFloatAdjustment,
} from "@/lib/register-change-float"
import { cn } from "@/lib/utils"

type PortalRegisterFloatAdjustDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentFloat: number
  recentAdjustments?: RegisterFloatAdjustment[]
  onApplied: () => void | Promise<void>
  /** Compact styling for portal header */
  variant?: "default" | "header"
}

function formatAdjustmentWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export function PortalRegisterFloatAdjustDialog({
  open,
  onOpenChange,
  currentFloat,
  recentAdjustments = [],
  onApplied,
  variant = "default",
}: PortalRegisterFloatAdjustDialogProps) {
  const [direction, setDirection] = useState<"add" | "subtract">("subtract")
  const [amountText, setAmountText] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setDirection("subtract")
    setAmountText("")
    setNote("")
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const submit = async () => {
    const parsed = parsePortalExtraChargeInput(amountText)
    if (parsed <= 0) {
      setError("Pon un monto mayor a 0.")
      return
    }
    if (note.trim().length < 2) {
      setError("Escribe un motivo (ej. proveedor, nómina, depósito).")
      return
    }
    const signed = direction === "add" ? parsed : -parsed
    setSaving(true)
    setError(null)
    const result = await staffApplyRegisterFloatAdjustment(signed, note.trim())
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar.")
      return
    }
    resetForm()
    onOpenChange(false)
    await onApplied()
  }

  const isHeader = variant === "header"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[min(90vh,36rem)] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Ajustar fondo caja</DialogTitle>
          <DialogDescription>
            Fondo actual:{" "}
            <strong className="text-foreground tabular-nums">
              {formatCajaMoney(currentFloat)}
            </strong>
            . Registra entradas o salidas de efectivo del fondo para cambio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={direction === "add" ? "default" : "outline"}
                className="h-auto py-2 flex-col gap-0.5"
                onClick={() => setDirection("add")}
              >
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
              <Button
                type="button"
                variant={direction === "subtract" ? "default" : "outline"}
                className="h-auto py-2 flex-col gap-0.5"
                onClick={() => setDirection("subtract")}
              >
                <Minus className="h-4 w-4" />
                Quitar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {direction === "add"
                ? "Ej. depositas más efectivo al fondo."
                : "Ej. pagas proveedor, compra de empleado (nómina), retiro."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="float-adjust-amount">Monto</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                id="float-adjust-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="pl-7 tabular-nums"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="float-adjust-note">Motivo</Label>
            <Textarea
              id="float-adjust-note"
              placeholder="Ej. Proveedor tortillas, Juan compró hielo (nómina), depósito inicio turno"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {recentAdjustments.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recientes
              </p>
              <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
                {recentAdjustments.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-md border border-border/70 px-2.5 py-2"
                  >
                    <div className="flex justify-between gap-2 tabular-nums">
                      <span
                        className={cn(
                          "font-semibold",
                          row.amount >= 0
                            ? "text-green-700 dark:text-green-400"
                            : "text-destructive",
                        )}
                      >
                        {row.amount >= 0 ? "+" : "−"}
                        {formatCajaMoney(Math.abs(row.amount))}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatCajaMoney(row.balanceAfter)}
                      </span>
                    </div>
                    <p className="text-xs mt-1">{row.note}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatAdjustmentWhen(row.createdAt)}
                      {row.createdByName ? ` · ${row.createdByName}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className={isHeader ? "gap-2 sm:gap-0" : undefined}>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Guardando…
              </>
            ) : (
              "Registrar ajuste"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
