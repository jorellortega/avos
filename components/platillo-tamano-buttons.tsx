"use client"

import { Button } from "@/components/ui/button"
import {
  bebidaTamanoLabels,
  type BebidaTamano,
} from "@/lib/menu-data"
import type { MenuCatalogHelpers } from "@/lib/menu-catalog-shared"
import { cn } from "@/lib/utils"

type PlatilloTamanoButtonsProps = {
  categoriaId: string
  platilloId: string
  catalog: MenuCatalogHelpers | null
  precioChico: number
  precioGrande: number
  disabled?: boolean
  className?: string
  /** Highlights the active size (selection mode). */
  selectedTamano?: BebidaTamano
  tamanoLabelChico?: string
  tamanoLabelGrande?: string
  onSelect: (tamano: BebidaTamano) => void
}

export function PlatilloTamanoButtons({
  categoriaId,
  platilloId,
  catalog,
  precioChico,
  precioGrande,
  disabled,
  className,
  selectedTamano,
  tamanoLabelChico,
  tamanoLabelGrande,
  onSelect,
}: PlatilloTamanoButtonsProps) {
  const labels = {
    chico: tamanoLabelChico ?? bebidaTamanoLabels.chico,
    grande: tamanoLabelGrande ?? bebidaTamanoLabels.grande,
  }
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {(["chico", "grande"] as const).map((tam) => {
        const precio =
          catalog?.getPlatilloPrecioTamano(categoriaId, platilloId, tam) ??
          (tam === "chico" ? precioChico : precioGrande)
        const isSel = selectedTamano === tam
        return (
          <Button
            key={tam}
            type="button"
            variant={isSel ? "default" : "outline"}
            className="h-auto py-2 flex-col"
            disabled={disabled}
            onClick={() => onSelect(tam)}
          >
            <span className="font-semibold text-sm">{labels[tam]}</span>
            <span className="text-xs text-muted-foreground">${precio}</span>
          </Button>
        )
      })}
    </div>
  )
}
