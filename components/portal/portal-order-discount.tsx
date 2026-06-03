"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  ORDER_DISCOUNT_PRESET_LABELS,
  type OrderDiscountPreset,
  type OrderDiscountState,
  parseOrderDiscountPercentInput,
} from "@/lib/order-discount"

type PortalOrderDiscountProps = {
  state: OrderDiscountState
  discountAmount: number
  onChange: (state: OrderDiscountState) => void
  disabled?: boolean
}

export function PortalOrderDiscount({
  state,
  discountAmount,
  onChange,
  disabled,
}: PortalOrderDiscountProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(
    state.preset ? "" : state.percent && state.percent > 0 ? String(state.percent) : "",
  )

  const hasDiscount =
    discountAmount > 0 || Boolean(state.preset) || (state.percent ?? 0) > 0

  useEffect(() => {
    if (state.preset) {
      setText("")
      return
    }
    const pct = state.percent && state.percent > 0 ? String(state.percent) : ""
    setText((prev) => {
      const parsed = parseOrderDiscountPercentInput(prev)
      if (parsed === (state.percent ?? 0)) return prev
      return pct
    })
  }, [state.preset, state.percent])

  const setPreset = (preset: OrderDiscountPreset) => {
    const active = state.preset === preset
    onChange(active ? {} : { preset })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1 text-xs font-medium transition-colors",
            "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
          aria-expanded={open}
          aria-label="Descuento"
        >
          <span>Desc.</span>
          {!open && hasDiscount ? (
            <span className="text-emerald-700 dark:text-emerald-400 tabular-nums font-normal">
              −${discountAmount.toFixed(2)}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
        <Label htmlFor="portal-discount-percent" className="text-sm font-medium">
          Porcentaje <span className="text-muted-foreground font-normal">(%)</span>
        </Label>
        <Input
          id="portal-discount-percent"
          type="text"
          inputMode="decimal"
          placeholder="0"
          disabled={disabled || Boolean(state.preset)}
          className="tabular-nums"
          value={text}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            const pct = parseOrderDiscountPercentInput(next)
            onChange(pct > 0 ? { percent: pct } : {})
          }}
          onBlur={() => {
            const pct = parseOrderDiscountPercentInput(text)
            setText(pct > 0 ? String(pct) : "")
            onChange(pct > 0 ? { percent: pct } : {})
          }}
        />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ORDER_DISCOUNT_PRESET_LABELS) as OrderDiscountPreset[]).map(
            (preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={state.preset === preset ? "default" : "outline"}
                disabled={disabled}
                className={cn("text-xs sm:text-sm")}
                onClick={() => setPreset(preset)}
              >
                {ORDER_DISCOUNT_PRESET_LABELS[preset]}
              </Button>
            ),
          )}
        </div>
        {discountAmount > 0 ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            −${discountAmount.toFixed(2)} MXN
            {state.preset === "employee_meal"
              ? " · comida y aguas frescas gratis; embotelladas se cobran"
              : null}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Presets para empleados. También puedes escribir un % manual.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
