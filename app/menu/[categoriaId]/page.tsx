import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MenuCategoriaPlatillosGrid } from "@/components/menu-categoria-platillos-grid"
import { MenuCategoryCartBar } from "@/components/menu-category-cart-bar"
import { MenuCategoriaGuard } from "@/components/menu-categoria-guard"
import { MenuCategoryLinks } from "@/components/menu-category-links"
import {
  categorias,
  getCategoriaById,
} from "@/lib/menu-data"
import { getSiteMedia } from "@/lib/get-site-media"

export const revalidate = 30

type Props = {
  params: Promise<{ categoriaId: string }>
}

export function generateStaticParams() {
  return categorias.map((c) => ({ categoriaId: c.id }))
}

export async function generateMetadata({ params }: Props) {
  const { categoriaId } = await params
  const categoria = getCategoriaById(categoriaId)
  if (!categoria) {
    return { title: "Categoría no encontrada | Avos" }
  }
  return {
    title: `${categoria.nombre} | Menú Avos`,
    description: categoria.descripcion,
  }
}

export default async function CategoriaMenuPage({ params }: Props) {
  const { categoriaId } = await params
  const categoria = getCategoriaById(categoriaId)
  if (!categoria) {
    notFound()
  }

  const media = await getSiteMedia()
  const heroImagen =
    media.categoriaImagenes[categoria.id] ?? categoria.imagen

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <MenuCategoriaGuard categoriaId={categoria.id}>
      <main className="flex-1">
        <section className="relative h-40 md:h-52 bg-primary/10">
          <Image
            src={heroImagen}
            alt={categoria.nombre}
            fill
            className="object-cover object-top opacity-30"
            priority
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
            <Link
              href="/menu"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Menú completo
            </Link>
            <h1
              className="text-3xl md:text-4xl font-bold text-foreground text-center"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {categoria.nombre}
            </h1>
            <p className="text-muted-foreground text-center max-w-lg text-sm md:text-base">
              {categoria.descripcion}
            </p>
          </div>
        </section>

        <section className="py-10 md:py-14">
          <div className="container mx-auto px-4 max-w-5xl">
            <MenuCategoriaPlatillosGrid
              categoria={categoria}
              imagen={heroImagen}
              proteinaImagenes={media.proteinaImagenes}
            />
            <div className="mt-8 max-w-lg mx-auto">
              <MenuCategoryCartBar />
            </div>
          </div>

          <MenuCategoryLinks excludeId={categoria.id} />
        </section>
      </main>
      </MenuCategoriaGuard>

      <Footer />
    </div>
  )
}
