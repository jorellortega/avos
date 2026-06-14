"use client"

import { useMemo, type ReactNode } from "react"
import { MenuItemCard } from "@/components/menu-item-card"
import { resolvePlatilloTieneProteinas } from "@/lib/platillo-config"
import { BebidaCard } from "@/components/bebida-card"
import { MENU_INSTAGRAM_GRID_CLASS } from "@/components/menu-collage-tile"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import {
  BEBIDAS_CATEGORIA_ID,
  bebidas,
  categorias,
  getCategoriaById,
  getPlatillosForCategoria,
} from "@/lib/menu-data"
import type { SiteMedia } from "@/lib/site-media-shared"

type Props = {
  media: SiteMedia
}

export function MenuPageGrid({ media }: Props) {
  const { catalog, loading } = useMenuCatalogContext()

  const tiles = useMemo(() => {
    const out: ReactNode[] = []

    for (const categoria of categorias) {
      const cat = getCategoriaById(categoria.id)
      if (!cat) continue
      if (!loading && catalog?.isCategoriaHidden(categoria.id)) continue

      const imagen =
        media.categoriaImagenes[categoria.id] ?? categoria.imagen
      const platillos = getPlatillosForCategoria(cat).filter(
        (p) => !catalog?.isPlatilloHidden(categoria.id, p.id),
      )

      for (const platillo of platillos) {
        out.push(
          <MenuItemCard
            key={`${categoria.id}-${platillo.id}`}
            collapsible
            categoryBadge={categoria.nombre}
            tileImagen={imagen}
            categoriaId={categoria.id}
            platilloId={platillo.id}
            categoria={categoria.nombre}
            nombre={
              catalog?.getPlatilloNombre(categoria.id, platillo.id) ??
              platillo.nombre
            }
            descripcion={platillo.descripcion}
            precioBase={platillo.precioBase}
            tieneProteinas={resolvePlatilloTieneProteinas(platillo, categoria)}
            tieneTamanos={platillo.tieneTamanos === true}
            precioChico={platillo.precioChico}
            precioGrande={platillo.precioGrande}
            tamanoLabelChico={platillo.tamanoLabelChico}
            tamanoLabelGrande={platillo.tamanoLabelGrande}
            preciosProteinaTamano={platillo.preciosProteinaTamano}
            proteinasPlatillo={platillo.proteinas}
            opciones={platillo.opciones}
            imagen={imagen}
            proteinaImagenes={media.proteinaImagenes}
          />,
        )
      }
    }

    if (!loading && !catalog?.isCategoriaHidden(BEBIDAS_CATEGORIA_ID)) {
      if (!catalog?.isCategoriaOut(BEBIDAS_CATEGORIA_ID)) {
        for (const bebida of bebidas) {
          if (catalog?.isBebidaHidden(bebida.id)) continue
          out.push(
            <BebidaCard key={bebida.id} bebida={bebida} collapsible />,
          )
        }
      }
    }

    return out
  }, [catalog, loading, media])

  if (loading && tiles.length === 0) {
    return (
      <div className={MENU_INSTAGRAM_GRID_CLASS}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square w-full rounded-sm bg-muted animate-pulse"
          />
        ))}
      </div>
    )
  }

  return <div className={MENU_INSTAGRAM_GRID_CLASS}>{tiles}</div>
}
