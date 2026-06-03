"use client"

import Link from "next/link"
import { MenuItemCard } from "@/components/menu-item-card"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import {
  getCategoriaById,
  getPlatillosForCategoria,
  type Proteina,
} from "@/lib/menu-data"

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
  const categoria = getCategoriaById(categoriaId)
  const platillos = categoria ? getPlatillosForCategoria(categoria) : []

  if (!loading && catalog?.isCategoriaHidden(categoriaId)) {
    return null
  }

  return (
    <div
      className={`mb-8 ${sectionIndex > 0 ? "pt-6 border-t border-border" : ""}`}
      id={categoriaId}
    >
      <div className="mb-3">
        <h2
          className="text-xl md:text-2xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <Link
            href={`/menu/${categoriaId}`}
            className="hover:text-primary transition-colors"
          >
            {categoriaNombre}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
          {descripcion}
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {platillos
          .filter(
            (platillo) =>
              !catalog?.isPlatilloHidden(categoriaId, platillo.id),
          )
          .map((platillo) => (
          <MenuItemCard
            key={platillo.id}
            collapsible
            categoriaId={categoriaId}
            platilloId={platillo.id}
            categoria={categoriaNombre}
            nombre={platillo.nombre}
            descripcion={platillo.descripcion}
            precioBase={platillo.precioBase}
            tieneProteinas={platillo.tieneProteinas !== false}
            tieneTamanos={platillo.tieneTamanos === true}
            precioChico={platillo.precioChico}
            precioGrande={platillo.precioGrande}
            tamanoLabelChico={platillo.tamanoLabelChico}
            tamanoLabelGrande={platillo.tamanoLabelGrande}
            preciosProteinaTamano={platillo.preciosProteinaTamano}
            proteinasPlatillo={platillo.proteinas}
            opciones={platillo.opciones}
            imagen={imagen}
            proteinaImagenes={proteinaImagenes}
          />
        ))}
      </div>
    </div>
  )
}
