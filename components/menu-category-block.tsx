"use client"

import Link from "next/link"
import { MenuItemCard } from "@/components/menu-item-card"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import type { Proteina } from "@/lib/menu-data"

type Props = {
  categoriaId: string
  categoriaNombre: string
  descripcion: string
  precioBase: number
  tieneProteinas: boolean
  imagen: string
  proteinaImagenes?: Partial<Record<Proteina, string>>
  sectionIndex: number
}

export function MenuCategoryBlock({
  categoriaId,
  categoriaNombre,
  descripcion,
  precioBase,
  tieneProteinas,
  imagen,
  proteinaImagenes,
  sectionIndex,
}: Props) {
  const { catalog, loading } = useMenuCatalogContext()

  if (!loading && catalog?.isCategoriaHidden(categoriaId)) {
    return null
  }

  return (
    <div
      className={`mb-16 ${sectionIndex > 0 ? "pt-8 border-t border-border" : ""}`}
      id={categoriaId}
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <h2
            className="text-2xl md:text-3xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Link
              href={`/menu/${categoriaId}`}
              className="hover:text-primary transition-colors"
            >
              {categoriaNombre}
            </Link>
          </h2>
          <p className="text-muted-foreground mt-1">{descripcion}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MenuItemCard
          categoriaId={categoriaId}
          categoria={categoriaNombre}
          nombre={categoriaNombre}
          descripcion={descripcion}
          precioBase={precioBase}
          tieneProteinas={tieneProteinas}
          imagen={imagen}
          proteinaImagenes={proteinaImagenes}
        />
      </div>
    </div>
  )
}
