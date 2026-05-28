"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function parsePortalExtraChargeInput(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, ".")
  if (!cleaned) return 0
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

type PortalExtraChargeProps = {
  value: number
  onChange: (amount: number) => void
  disabled?: boolean
}

export function PortalExtraCharge({
  value,
  onChange,
  disabled,
}: PortalExtraChargeProps) {
  const [text, setText] = useState(value > 0 ? value.toFixed(2) : "")

  useEffect(() => {
    const formatted = value > 0 ? value.toFixed(2) : ""
    setText((prev) => {
      const parsed = parsePortalExtraChargeInput(prev)
      if (parsed === value) return prev
      return formatted
    })
  }, [value])

  return (
    <div className="space-y-1.5">
      <Label htmlFor="portal-extra-charge" className="text-sm font-medium">
        Cargo adicional <span className="text-muted-foreground font-normal">(opcional)</span>
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          $
        </span>
        <Input
          id="portal-extra-charge"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          disabled={disabled}
          className="pl-7 tabular-nums"
          value={text}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            onChange(parsePortalExtraChargeInput(next))
          }}
          onBlur={() => {
            const parsed = parsePortalExtraChargeInput(text)
            setText(parsed > 0 ? parsed.toFixed(2) : "")
            onChange(parsed)
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Propina, envío extra u otro cobro que no está en el menú.
      </p>
    </div>
  )
}
