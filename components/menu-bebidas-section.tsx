"use client"

import { BEBIDAS_CATEGORIA_ID, bebidas } from "@/lib/menu-data"
import { BebidaCard } from "@/components/bebida-card"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"

export function MenuBebidasSection() {
  const { catalog } = useMenuCatalogContext()

  if (catalog?.isCategoriaHidden(BEBIDAS_CATEGORIA_ID)) {
    return null
  }

  if (catalog?.isCategoriaOut(BEBIDAS_CATEGORIA_ID)) {
    return (
      <div className="pt-8 border-t border-border" id="bebidas">
        <div className="mb-6">
          <h2
            className="text-2xl md:text-3xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Bebidas
          </h2>
          <p className="text-destructive font-medium mt-2">
            No disponibles por el momento.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-8 border-t border-border" id="bebidas">
      <div className="mb-3">
        <h2
          className="text-xl md:text-2xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Bebidas
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">Aguas Frescas</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {bebidas
          .filter((bebida) => !catalog?.isBebidaHidden(bebida.id))
          .map((bebida) => (
            <BebidaCard key={bebida.id} bebida={bebida} collapsible />
          ))}
      </div>
    </div>
  )
}
