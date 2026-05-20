"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"

type Props = {
  categoriaId: string
  children: React.ReactNode
}

export function MenuCategoriaGuard({ categoriaId, children }: Props) {
  const { catalog, loading } = useMenuCatalogContext()

  if (loading) {
    return <div className="min-h-[40vh]" aria-busy="true" />
  }

  if (catalog?.isCategoriaHidden(categoriaId)) {
    return (
      <main className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="text-center max-w-md">
          <h1
            className="text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            No disponible
          </h1>
          <p className="text-muted-foreground mb-6">
            Este platillo aún no está en el menú.
          </p>
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver al menú
          </Link>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
