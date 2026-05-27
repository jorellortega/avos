"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function parsePaidInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").trim()
  if (!cleaned) return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

type PortalCashChangeProps = {
  total: number
  /** Light text on green/amber payment banner */
  variant?: "default" | "banner"
  className?: string
}

export function PortalCashChange({
  total,
  variant = "default",
  className,
}: PortalCashChangeProps) {
  const [paidInput, setPaidInput] = useState("")

  useEffect(() => {
    setPaidInput("")
  }, [total])

  const paid = useMemo(() => parsePaidInput(paidInput), [paidInput])
  const change =
    paid != null && paid >= total ? Math.round((paid - total) * 100) / 100 : null
  const shortfall =
    paid != null && paid > 0 && paid < total
      ? Math.round((total - paid) * 100) / 100
      : null

  const isBanner = variant === "banner"
  const labelClass = isBanner ? "text-white/90" : undefined
  const inputClass = isBanner
    ? "bg-white/15 border-white/30 text-white placeholder:text-white/50"
    : undefined
  const changeClass = isBanner ? "text-white" : "text-green-700 dark:text-green-400"
  const shortfallClass = isBanner ? "text-amber-100" : "text-amber-700 dark:text-amber-400"

  function setQuickAmount(amount: number) {
    setPaidInput(amount.toFixed(2))
  }

  const quickAmounts = useMemo(() => {
    const base = [total, 200, 500, 1000]
    const uniq = [...new Set(base.map((n) => Math.round(n * 100) / 100))].sort(
      (a, b) => a - b,
    )
    return uniq.filter((n) => n >= total).slice(0, 5)
  }, [total])

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <Label htmlFor="portal-paid-amount" className={labelClass}>
          Pagaron (efectivo)
        </Label>
        <div className="relative">
          <span
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none",
              isBanner ? "text-white/70" : "text-muted-foreground",
            )}
          >
            $
          </span>
          <Input
            id="portal-paid-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={paidInput}
            onChange={(e) => setPaidInput(e.target.value)}
            className={cn("pl-7", inputClass)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickAmounts.map((amount) => (
            <Button
              key={amount}
              type="button"
              size="sm"
              variant={isBanner ? "secondary" : "outline"}
              className={cn(
                "h-7 text-xs",
                isBanner && "bg-white/20 text-white border-white/30 hover:bg-white/30",
              )}
              onClick={() => setQuickAmount(amount)}
            >
              ${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}
            </Button>
          ))}
        </div>
      </div>

      {change != null && (
        <div
          className={cn(
            "flex items-center justify-between rounded-md px-3 py-2",
            isBanner ? "bg-white/15" : "bg-green-500/10 border border-green-500/20",
          )}
        >
          <span className={cn("font-semibold", changeClass)}>Cambio</span>
          <span className={cn("text-xl font-bold tabular-nums", changeClass)}>
            ${change.toFixed(2)}
          </span>
        </div>
      )}

      {shortfall != null && (
        <p className={cn("text-sm font-medium", shortfallClass)}>
          Faltan ${shortfall.toFixed(2)} para cubrir el total.
        </p>
      )}
    </div>
  )
}
