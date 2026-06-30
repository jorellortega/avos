"use client"

import { MenuItemCard } from "@/components/menu-item-card"
import { resolvePlatilloTieneProteinas } from "@/lib/platillo-config"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import {
  getPlatillosForCategoria,
  getProteinasForPlatillo,
  type CategoriaMenu,
  type Proteina,
  type ProteinaPlatillo,
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

  const cards = getPlatillosForCategoria(categoria)
    .filter(
      (platillo) => !catalog?.isPlatilloHidden(categoria.id, platillo.id),
    )
    .flatMap((platillo) => {
      const baseNombre =
        catalog?.getPlatilloNombre(categoria.id, platillo.id) ??
        platillo.nombre
      const tieneProteinas = resolvePlatilloTieneProteinas(platillo, categoria)
      const commonProps = {
        categoriaId: categoria.id,
        platilloId: platillo.id,
        categoria: categoria.nombre,
        descripcion: platillo.descripcion,
        precioBase: platillo.precioBase,
        tieneProteinas,
        tieneTamanos: platillo.tieneTamanos === true,
        precioChico: platillo.precioChico,
        precioGrande: platillo.precioGrande,
        tamanoLabelChico: platillo.tamanoLabelChico,
        tamanoLabelGrande: platillo.tamanoLabelGrande,
        preciosProteinaTamano: platillo.preciosProteinaTamano,
        proteinasPlatillo: platillo.proteinas,
        opciones: platillo.opciones,
        imagen,
        proteinaImagenes,
      }

      if (!tieneProteinas) {
        return [
          <MenuItemCard key={platillo.id} {...commonProps} nombre={baseNombre} />,
        ]
      }

      const proteinas = getProteinasForPlatillo(platillo, categoria).filter(
        (p) => !catalog?.isProteinaHidden(categoria.id, p, platillo.id),
      )

      if (proteinas.length <= 1) {
        return [
          <MenuItemCard
            key={platillo.id}
            {...commonProps}
            nombre={baseNombre}
            presetProteina={proteinas[0]}
          />,
        ]
      }

      return proteinas.map((proteina) => (
        <MenuItemCard
          key={`${platillo.id}-${proteina}`}
          {...commonProps}
          nombre={baseNombre}
          presetProteina={proteina}
        />
      ))
    })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards}
    </div>
  )
}
