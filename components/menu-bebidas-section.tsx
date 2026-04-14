"use client"

import { BEBIDAS_CATEGORIA_ID, bebidas } from "@/lib/menu-data"
import { BebidaCard } from "@/components/bebida-card"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"

export function MenuBebidasSection() {
  const { catalog } = useMenuCatalogContext()

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
      <div className="mb-6">
        <h2
          className="text-2xl md:text-3xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Bebidas
        </h2>
        <p className="text-muted-foreground mt-1">Aguas Frescas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {bebidas.map((bebida) => (
          <BebidaCard
            key={bebida.id}
            id={bebida.id}
            nombre={bebida.nombre}
            precio={bebida.precio}
          />
        ))}
      </div>
    </div>
  )
}
