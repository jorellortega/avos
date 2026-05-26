"use client"

import type { OrderType } from "@/components/orders-provider"
import { PORTAL_TIPO_OPTIONS } from "@/lib/portal-order-tipo"
import { cn } from "@/lib/utils"

/** Same high-contrast amber for every selected tipo (matches Llevar). */
const INLINE_ACTIVE =
  "bg-amber-600 !text-white shadow-sm ring-1 ring-amber-700/40"

const INLINE_IDLE =
  "text-amber-950/85 hover:bg-amber-100/90 dark:text-amber-50/90 dark:hover:bg-amber-950/50"

type PortalOrderTipoPickerProps = {
  value: OrderType
  onChange: (tipo: OrderType) => void
  disabled?: boolean
  className?: string
  /** Header bar on portal (no label). */
  variant?: "default" | "header" | "inline"
}

export function PortalOrderTipoPicker({
  value,
  onChange,
  disabled,
  className,
  variant = "default",
}: PortalOrderTipoPickerProps) {
  const isHeader = variant === "header"
  const isInline = variant === "inline"

  return (
    <div
      className={cn("inline-flex items-center", className)}
      role="group"
      aria-label="Tipo de orden"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "inline-flex gap-0.5",
          isInline
            ? "rounded-full border border-border/80 bg-muted/40 p-0.5 w-auto"
            : cn(
                "rounded-lg p-0.5 gap-0.5 w-full",
                isHeader && "bg-primary-foreground/15",
                !isHeader && "border bg-muted/50",
              ),
        )}
      >
        {PORTAL_TIPO_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isInline
                ? cn(
                    "rounded-full px-2 py-0.5 text-[10px] leading-tight",
                    value === opt.value ? INLINE_ACTIVE : INLINE_IDLE,
                  )
                : cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium",
                    isHeader
                      ? value === opt.value
                        ? "bg-primary-foreground text-primary shadow-sm"
                        : "text-primary-foreground/90 hover:bg-primary-foreground/20"
                      : value === opt.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/80",
                  ),
              disabled && "opacity-50 pointer-events-none",
            )}
            aria-pressed={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
