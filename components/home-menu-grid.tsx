"use client"

import Image from "next/image"
import Link from "next/link"
import {
  BEBIDAS_CATEGORIA_ID,
  categorias,
  imagenCategoriaBebidas,
} from "@/lib/menu-data"
import type { SiteMedia } from "@/lib/site-media-shared"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import { cn } from "@/lib/utils"

const categoriaEmoji: Record<string, string> = {
  tacos: "🌮",
  tortas: "🥪",
  burritos: "🌯",
  quesadillas: "🧀",
  platillos: "🍽️",
  bebidas: "🥤",
}

type Props = {
  media: SiteMedia
}

export function HomeMenuGrid({ media }: Props) {
  const { catalog, loading } = useMenuCatalogContext()

  const cardClass =
    "bg-card rounded-2xl p-4 md:p-6 text-center shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 overflow-hidden"

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
      {categorias.map((categoria) => {
        const thumb =
          media.categoriaImagenes[categoria.id] ?? categoria.imagen
        const fuera = !loading && catalog?.isCategoriaOut(categoria.id)

        if (fuera) {
          return (
            <div
              key={categoria.id}
              className={cn(cardClass, "opacity-60 cursor-not-allowed")}
            >
              <div className="relative aspect-[4/3] w-full max-w-[140px] mx-auto mb-3 rounded-xl overflow-hidden bg-muted">
                <Image
                  src={thumb}
                  alt=""
                  fill
                  className="object-cover grayscale"
                  sizes="(max-width: 768px) 40vw, 140px"
                />
              </div>
              <div className="text-3xl mb-2" aria-hidden>
                {categoriaEmoji[categoria.id] ?? "🍴"}
              </div>
              <h3 className="font-semibold text-foreground text-sm md:text-base">
                {categoria.nombre}
              </h3>
              <p className="text-xs text-destructive font-medium mt-1">Agotado</p>
            </div>
          )
        }

        return (
          <Link
            key={categoria.id}
            href={`/menu/${categoria.id}`}
            className={cn(
              cardClass,
              "hover:shadow-md block cursor-pointer",
            )}
          >
            <div className="relative aspect-[4/3] w-full max-w-[140px] mx-auto mb-3 rounded-xl overflow-hidden bg-muted">
              <Image
                src={thumb}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 40vw, 140px"
              />
            </div>
            <div className="text-3xl mb-2" aria-hidden>
              {categoriaEmoji[categoria.id] ?? "🍴"}
            </div>
            <h3 className="font-semibold text-foreground text-sm md:text-base">
              {categoria.nombre}
            </h3>
          </Link>
        )
      })}

      {(() => {
        const thumb =
          media.categoriaImagenes[BEBIDAS_CATEGORIA_ID] ?? imagenCategoriaBebidas
        const fuera = !loading && catalog?.isCategoriaOut(BEBIDAS_CATEGORIA_ID)

        if (fuera) {
          return (
            <div
              className={cn(cardClass, "opacity-60 cursor-not-allowed")}
            >
              <div className="relative aspect-[4/3] w-full max-w-[140px] mx-auto mb-3 rounded-xl overflow-hidden bg-muted">
                <Image
                  src={thumb}
                  alt=""
                  fill
                  className="object-cover grayscale"
                  sizes="(max-width: 768px) 40vw, 140px"
                />
              </div>
              <div className="text-3xl mb-2" aria-hidden>
                {categoriaEmoji.bebidas}
              </div>
              <h3 className="font-semibold text-foreground text-sm md:text-base">
                Bebidas
              </h3>
              <p className="text-xs text-destructive font-medium mt-1">Agotado</p>
            </div>
          )
        }

        return (
          <Link
            href="/menu#bebidas"
            className={cn(cardClass, "hover:shadow-md block cursor-pointer")}
          >
            <div className="relative aspect-[4/3] w-full max-w-[140px] mx-auto mb-3 rounded-xl overflow-hidden bg-muted">
              <Image
                src={thumb}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 40vw, 140px"
              />
            </div>
            <div className="text-3xl mb-2" aria-hidden>
              {categoriaEmoji.bebidas}
            </div>
            <h3 className="font-semibold text-foreground text-sm md:text-base">
              Bebidas
            </h3>
          </Link>
        )
      })()}
    </div>
  )
}
