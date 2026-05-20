"use client"

import Link from "next/link"
import { categorias } from "@/lib/menu-data"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"

type Props = {
  excludeId: string
}

export function MenuCategoryLinks({ excludeId }: Props) {
  const { catalog, loading } = useMenuCatalogContext()

  const visible = categorias.filter((c) => {
    if (c.id === excludeId) return false
    if (!loading && catalog?.isCategoriaHidden(c.id)) return false
    return true
  })

  if (visible.length === 0) return null

  return (
    <div className="container mx-auto px-4 mt-12 max-w-2xl">
      <p className="text-sm font-medium text-foreground mb-3 text-center">
        Otras categorías
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {visible.map((c) => (
          <Link
            key={c.id}
            href={`/menu/${c.id}`}
            className="px-3 py-1.5 rounded-full border border-border text-sm hover:bg-secondary transition-colors"
          >
            {c.nombre}
          </Link>
        ))}
      </div>
    </div>
  )
}
