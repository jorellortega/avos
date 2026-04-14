"use client"

import { useId } from "react"
import { Utensils, ShoppingBag } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { MenuServiceMode } from "@/hooks/use-menu-order-service"

export type MenuOrderServicePickerProps = {
  mode: MenuServiceMode | null
  setMode: (m: MenuServiceMode) => void
  mesa: string
  setMesa: (v: string) => void
  hydrated: boolean
  className?: string
  showTakeoutCardNotice?: boolean
}

export function MenuOrderServicePicker({
  mode,
  setMode,
  mesa,
  setMesa,
  hydrated,
  className,
  showTakeoutCardNotice = true,
}: MenuOrderServicePickerProps) {
  const mesaId = useId()

  if (!hydrated) {
    return (
      <div
        className={cn("h-28 animate-pulse rounded-lg bg-muted", className)}
        aria-hidden
      />
    )
  }

  const ring = (m: MenuServiceMode) =>
    mode === m
      ? "ring-2 ring-primary bg-primary/10 border-primary"
      : "border-border hover:border-primary/50 bg-card"

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm font-medium text-foreground">¿Cómo ordenas?</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("takeout")}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ring("takeout"),
          )}
        >
          <ShoppingBag className="h-6 w-6 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Para llevar</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("dine-in")}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ring("dine-in"),
          )}
        >
          <Utensils className="h-6 w-6 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Para aquí</span>
        </button>
      </div>

      {mode === "dine-in" && (
        <div className="space-y-1.5">
          <Label htmlFor={mesaId}>Número de mesa</Label>
          <Input
            id={mesaId}
            value={mesa}
            onChange={(e) => setMesa(e.target.value)}
            placeholder="Ej. 12"
            inputMode="numeric"
            autoComplete="off"
            className="max-w-[12rem]"
          />
        </div>
      )}

      {showTakeoutCardNotice && mode === "takeout" && (
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 rounded-lg px-3 py-2">
          Para llevar: pago con tarjeta al recoger (no efectivo).
        </p>
      )}
    </div>
  )
}
