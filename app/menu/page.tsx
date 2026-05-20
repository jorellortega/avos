import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MenuCategoryBlock } from "@/components/menu-category-block"
import { MenuBebidasSection } from "@/components/menu-bebidas-section"
import { categorias } from "@/lib/menu-data"
import { getSiteMedia } from "@/lib/get-site-media"

export const revalidate = 30

export default async function MenuPage() {
  const media = await getSiteMedia()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative h-48 md:h-64 bg-primary/10">
          <Image
            src={media.menuBannerUrl}
            alt="Menú de Avos"
            fill
            className="object-cover object-top opacity-30"
            priority
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h1
                className="text-4xl md:text-5xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Nuestro Menú
              </h1>
              <p className="text-muted-foreground mt-2">
                Elige tu platillo favorito y ordena para recoger
              </p>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            {categorias.map((categoria, index) => {
              const imagen =
                media.categoriaImagenes[categoria.id] ?? categoria.imagen
              return (
                <MenuCategoryBlock
                  key={categoria.id}
                  categoriaId={categoria.id}
                  categoriaNombre={categoria.nombre}
                  descripcion={categoria.descripcion}
                  precioBase={categoria.precioBase}
                  tieneProteinas={categoria.tieneProteinas}
                  imagen={imagen}
                  proteinaImagenes={media.proteinaImagenes}
                  sectionIndex={index}
                />
              )
            })}

            <MenuBebidasSection />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
