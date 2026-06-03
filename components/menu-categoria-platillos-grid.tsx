"use client"

import { MenuItemCard } from "@/components/menu-item-card"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import {
  getPlatillosForCategoria,
  type CategoriaMenu,
  type Proteina,
} from "@/lib/menu-data"

type Props = {
  categoria: CategoriaMenu
  imagen: string
  proteinaImagenes?: Partial<Record<Proteina, string>>
}

export function MenuCategoriaPlatillosGrid({
  categoria,
  imagen,
  proteinaImagenes,
}: Props) {
  const { catalog } = useMenuCatalogContext()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {getPlatillosForCategoria(categoria)
        .filter(
          (platillo) =>
            !catalog?.isPlatilloHidden(categoria.id, platillo.id),
        )
        .map((platillo) => (
          <MenuItemCard
            key={platillo.id}
            categoriaId={categoria.id}
            platilloId={platillo.id}
            categoria={categoria.nombre}
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
  )
}
