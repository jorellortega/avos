"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { PlatilloTamanoButtons } from "@/components/platillo-tamano-buttons"
import {
  getPlatilloPrecioDefault,
  getPlatilloPrecioProteinaTamanoDefault,
  getPlatilloTamanoLabel,
  getProteinasForPlatillo,
  proteinas,
  type BebidaTamano,
  type CategoriaMenu,
  type CategoriaPlatillo,
  type Proteina,
} from "@/lib/menu-data"
import type { MenuCatalogHelpers } from "@/lib/menu-catalog-shared"
import { platilloPickerFlags } from "@/lib/platillo-config"
import { cn } from "@/lib/utils"

type PlatilloOrderPickerProps = {
  categoria: CategoriaMenu
  platillo: CategoriaPlatillo
  catalog: MenuCatalogHelpers | null
  proteinaImgs?: Partial<Record<Proteina, string>>
  onAdd: (
    proteina?: Proteina,
    tamano?: BebidaTamano,
    opcionId?: string,
  ) => void
  /** Compact buttons for portal menu tab */
  variant?: "default" | "portal"
}

export function PlatilloOrderPicker({
  categoria,
  platillo,
  catalog,
  proteinaImgs,
  onAdd,
  variant = "default",
}: PlatilloOrderPickerProps) {
  const [selectedTamano, setSelectedTamano] = useState<BebidaTamano>("chico")
  const flags = platilloPickerFlags(platillo, categoria)
  const agotado =
    catalog?.isPlatilloOut(categoria.id, platillo.id) ?? false
  const proteinasMenu = getProteinasForPlatillo(platillo, categoria)

  const precioProteina = (p: Proteina) =>
    catalog?.getPrecioConProteina(
      categoria.id,
      p,
      platillo.id,
      flags.tieneTamanos ? selectedTamano : undefined,
    ) ??
    (() => {
      if (flags.tieneTamanos) {
        return getPlatilloPrecioProteinaTamanoDefault(platillo, p, selectedTamano)
      }
      const base = platillo.precioBase
      return p === "Camarón" ? base + 20 : base
    })()

  if (flags.tieneProteinas) {
    return (
      <div className="space-y-3">
        {flags.tieneTamanos ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Tamaño</p>
            <PlatilloTamanoButtons
              categoriaId={categoria.id}
              platilloId={platillo.id}
              catalog={catalog}
              precioChico={platillo.precioChico ?? platillo.precioBase}
              precioGrande={platillo.precioGrande ?? platillo.precioBase}
              tamanoLabelChico={platillo.tamanoLabelChico}
              tamanoLabelGrande={platillo.tamanoLabelGrande}
              disabled={agotado}
              selectedTamano={selectedTamano}
              onSelect={setSelectedTamano}
            />
          </div>
        ) : null}
        <div
          className={cn(
            "grid gap-2",
            variant === "portal"
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-2 sm:grid-cols-4",
          )}
        >
          {proteinasMenu.map((proteina) => {
            const hidden =
              catalog?.isProteinaHidden(categoria.id, proteina, platillo.id) ??
              false
            if (hidden) return null
            const out =
              catalog?.isProteinaOut(categoria.id, proteina, platillo.id) ??
              false
            const precio = precioProteina(proteina)
            return (
              <Button
                key={proteina}
                type="button"
                variant="outline"
                disabled={agotado || out}
                className={cn(
                  "h-auto p-0 flex-col overflow-hidden",
                  variant === "portal" && "min-h-[4.5rem]",
                )}
                onClick={() =>
                  onAdd(
                    proteina,
                    flags.tieneTamanos ? selectedTamano : undefined,
                  )
                }
              >
                {proteinaImgs?.[proteina] ? (
                  <span className="relative block w-full aspect-[4/3] bg-muted">
                    <Image
                      src={proteinaImgs[proteina]!}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  </span>
                ) : null}
                <span className="font-semibold py-1.5 text-sm">{proteina}</span>
                <span className="text-xs text-muted-foreground pb-2">
                  ${precio}
                  {flags.tieneTamanos ? (
                    <span className="block text-[10px]">
                      {getPlatilloTamanoLabel(platillo, selectedTamano)}
                    </span>
                  ) : null}
                </span>
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  if (flags.tieneOpciones && platillo.opciones?.length) {
    const precioOpcion = () =>
      catalog?.getPlatilloPrecioTamano(
        categoria.id,
        platillo.id,
        selectedTamano,
      ) ?? getPlatilloPrecioDefault(platillo, selectedTamano)

    return (
      <div className="space-y-3">
        {flags.tieneTamanos ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Tamaño</p>
            <PlatilloTamanoButtons
              categoriaId={categoria.id}
              platilloId={platillo.id}
              catalog={catalog}
              precioChico={platillo.precioChico ?? platillo.precioBase}
              precioGrande={platillo.precioGrande ?? platillo.precioBase}
              tamanoLabelChico={platillo.tamanoLabelChico}
              tamanoLabelGrande={platillo.tamanoLabelGrande}
              disabled={agotado}
              selectedTamano={selectedTamano}
              onSelect={setSelectedTamano}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Elige 1 fruta
          </p>
          <div
            className={cn(
              "grid gap-2",
              variant === "portal"
                ? "grid-cols-3"
                : "grid-cols-2 sm:grid-cols-3",
            )}
          >
            {platillo.opciones.map((opcion) => (
              <Button
                key={opcion.id}
                type="button"
                variant="outline"
                disabled={agotado}
                className={cn(
                  "h-auto py-3 flex-col",
                  variant === "portal" && "min-h-[3.5rem]",
                )}
                onClick={() =>
                  onAdd(
                    undefined,
                    flags.tieneTamanos ? selectedTamano : undefined,
                    opcion.id,
                  )
                }
              >
                <span className="font-semibold text-sm">{opcion.label}</span>
                <span className="text-xs text-muted-foreground">
                  ${precioOpcion()}
                  {flags.tieneTamanos ? (
                    <span className="block text-[10px]">
                      {getPlatilloTamanoLabel(platillo, selectedTamano)}
                    </span>
                  ) : null}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (flags.tieneTamanos) {
    return (
      <PlatilloTamanoButtons
        categoriaId={categoria.id}
        platilloId={platillo.id}
        catalog={catalog}
        precioChico={platillo.precioChico ?? platillo.precioBase}
        precioGrande={platillo.precioGrande ?? platillo.precioBase}
        tamanoLabelChico={platillo.tamanoLabelChico}
        tamanoLabelGrande={platillo.tamanoLabelGrande}
        disabled={agotado}
        onSelect={(tam) => onAdd(undefined, tam)}
      />
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={agotado}
      onClick={() => onAdd()}
    >
      Agregar · $
      {catalog?.getPlatilloPrecio(categoria.id, platillo.id) ?? platillo.precioBase}
    </Button>
  )
}
