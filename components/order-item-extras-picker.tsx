"use client"

import { useState } from "react"
import {
  defaultOrderExtras,
  defaultPlatilloCustomizationConfig,
  type PlatilloCustomizationConfig,
} from "@/lib/order-item-customizations"
import { toggleOrderExtra } from "@/lib/order-item-extras"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChevronDown, ChevronUp } from "lucide-react"

type Props = {
  config?: PlatilloCustomizationConfig | null
  extras: string[]
  customNote: string
  onExtrasChange: (extras: string[]) => void
  onCustomNoteChange: (note: string) => void
  className?: string
  compact?: boolean
  /** Per cart line: only pills, no section heading */
  inline?: boolean
  noteInputId?: string
}

export function OrderItemExtrasPicker({
  config: configProp,
  extras,
  customNote,
  onExtrasChange,
  onCustomNoteChange,
  className,
  compact,
  inline,
  noteInputId = "order-extra-note",
}: Props) {
  const config = configProp ?? defaultPlatilloCustomizationConfig()
  const defaultId = config.defaultId

  const hasCustomizeSelections =
    extras.some((id) => id !== defaultId) || Boolean(customNote.trim())
  const [showCustomize, setShowCustomize] = useState(hasCustomizeSelections)

  const conTodoActive =
    extras.includes(defaultId) && !hasCustomizeSelections

  const selectDefault = () => {
    setShowCustomize(false)
    onExtrasChange(defaultOrderExtras(config))
    onCustomNoteChange("")
  }

  const toggleCustomizePanel = () => {
    if (showCustomize) {
      selectDefault()
      return
    }
    setShowCustomize(true)
    onExtrasChange(extras.filter((id) => id !== defaultId))
  }

  if (config.options.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <button
          type="button"
          onClick={selectDefault}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors touch-manipulation",
            conTodoActive
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:border-primary/50",
          )}
        >
          {config.defaultLabel}
        </button>
      </div>
    )
  }

  return (
    <div className={cn(inline ? "space-y-2" : "space-y-3", className)}>
      <div>
        {!inline ? (
          <>
            <Label className={cn("text-sm font-medium", compact && "text-xs")}>
              ¿Cómo lo quieres?
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Por defecto va {config.defaultLabel.toLowerCase()}. Toca personalizar
              si quieres quitar algo.
            </p>
          </>
        ) : null}
        <div className={cn("flex flex-wrap gap-2", !inline && "mt-2")}>
          <button
            type="button"
            onClick={selectDefault}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors touch-manipulation",
              conTodoActive && !showCustomize
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:border-primary/50",
            )}
          >
            {config.defaultLabel}
          </button>
          <button
            type="button"
            onClick={toggleCustomizePanel}
            aria-expanded={showCustomize}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors touch-manipulation inline-flex items-center gap-1",
              showCustomize
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background hover:border-primary/50",
            )}
          >
            {showCustomize ? "Ocultar opciones" : "Personalizar"}
            {showCustomize ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>

        {showCustomize ? (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border animate-in fade-in-0 slide-in-from-top-1 duration-200">
            {config.options.map((option) => {
              const active = extras.includes(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    onExtrasChange(toggleOrderExtra(extras, option.id, config))
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors touch-manipulation",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-primary/50",
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {showCustomize ? (
        <div>
          <Label
            htmlFor={noteInputId}
            className={cn("text-sm font-medium", compact && "text-xs")}
          >
            Otra instrucción
          </Label>
          <Textarea
            id={noteInputId}
            value={customNote}
            onChange={(e) => onCustomNoteChange(e.target.value)}
            placeholder="Ej. poco picante, sin crema…"
            rows={compact ? 2 : 2}
            maxLength={200}
            className="mt-1.5 resize-none text-sm"
          />
        </div>
      ) : null}
    </div>
  )
}
