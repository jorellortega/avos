"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parsePortalExtraChargeInput } from "@/components/portal/portal-extra-charge"
import { cn } from "@/lib/utils"
import {
  ceoSetRegisterChangeFloat,
  fetchCajaSummaryClient,
} from "@/lib/register-change-float"

type PortalRegisterFloatProps = {
  className?: string
  /** Compact row for portal header */
  variant?: "default" | "header"
  /** Only CEO may change the value; staff always see the shared amount. */
  canEdit?: boolean
}

export function PortalRegisterFloat({
  className,
  variant = "default",
  canEdit = false,
}: PortalRegisterFloatProps) {
  const [text, setText] = useState("")
  const [amount, setAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { summary, error: err } = await fetchCajaSummaryClient()
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    const v = summary?.registerChangeFloat ?? 0
    setAmount(v)
    setText(v > 0 ? v.toFixed(2) : "")
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const persist = async (parsed: number) => {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    const result = await ceoSetRegisterChangeFloat(parsed)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar.")
      await load()
      return
    }
    setAmount(parsed)
    setText(parsed > 0 ? parsed.toFixed(2) : "")
  }

  const isHeader = variant === "header"

  const labelClass = isHeader
    ? "text-[10px] uppercase tracking-wide opacity-80 text-primary-foreground"
    : "text-sm font-medium"

  return (
    <div
      className={cn(
        isHeader && "w-[6.75rem] max-w-[6.75rem] shrink-0",
        className,
      )}
    >
      <Label
        htmlFor={canEdit ? "portal-register-float" : undefined}
        className={cn(labelClass, isHeader && "leading-tight block")}
      >
        {isHeader ? "Fondo caja" : "Fondo en caja"}
        {!isHeader && canEdit ? (
          <span className="text-muted-foreground font-normal"> (CEO)</span>
        ) : null}
      </Label>

      {loading ? (
        <p
          className={
            isHeader
              ? "mt-1 text-xs text-primary-foreground/80 flex items-center gap-1"
              : "mt-1 text-xs text-muted-foreground flex items-center gap-1"
          }
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Cargando…
        </p>
      ) : canEdit ? (
        <div className={cn("relative mt-1", isHeader && "w-full")}>
          <span
            className={
              isHeader
                ? "absolute left-2 top-1/2 -translate-y-1/2 text-xs text-primary-foreground/70"
                : "absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
            }
          >
            $
          </span>
          <Input
            id="portal-register-float"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            disabled={saving}
            className={
              isHeader
                ? "h-8 w-full min-w-0 pl-6 pr-2 text-sm bg-primary-foreground/15 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50 tabular-nums"
                : "pl-7 tabular-nums max-w-[8rem]"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              const parsed = parsePortalExtraChargeInput(text)
              setText(parsed > 0 ? parsed.toFixed(2) : "")
              void persist(parsed)
            }}
          />
        </div>
      ) : (
        <p
          className={
            isHeader
              ? "mt-1 text-sm font-semibold tabular-nums text-primary-foreground truncate"
              : "mt-1 text-lg font-bold tabular-nums text-primary"
          }
        >
          ${amount.toFixed(2)}
        </p>
      )}

      {!isHeader && canEdit ? (
        <p className="text-xs text-muted-foreground mt-1">
          Efectivo en la caja para dar cambio. Lo ve todo el personal en portal y en
          órdenes.
        </p>
      ) : null}
      {!isHeader && !canEdit ? (
        <p className="text-xs text-muted-foreground mt-1">
          Efectivo que dejó el CEO para dar cambio (mismo valor para todo el equipo).
        </p>
      ) : null}
      {amount <= 0 && !loading && !canEdit && !isHeader ? (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
          Sin fondo configurado
        </p>
      ) : null}
      {error ? (
        <p className="text-[10px] text-destructive mt-1" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
