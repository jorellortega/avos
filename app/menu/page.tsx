import Image from "next/image"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MenuItemCard } from "@/components/menu-item-card"
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
        {/* Hero Banner */}
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

        {/* Menu Categories */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            {categorias.map((categoria, index) => {
              const imagen =
                media.categoriaImagenes[categoria.id] ?? categoria.imagen
              return (
                <div
                  key={categoria.id}
                  className={`mb-16 ${index > 0 ? "pt-8 border-t border-border" : ""}`}
                  id={categoria.id}
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1">
                      <h2
                        className="text-2xl md:text-3xl font-bold text-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        <Link
                          href={`/menu/${categoria.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {categoria.nombre}
                        </Link>
                      </h2>
                      <p className="text-muted-foreground mt-1">
                        {categoria.descripcion}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MenuItemCard
                      categoriaId={categoria.id}
                      categoria={categoria.nombre}
                      nombre={categoria.nombre}
                      descripcion={categoria.descripcion}
                      precioBase={categoria.precioBase}
                      tieneProteinas={categoria.tieneProteinas}
                      imagen={imagen}
                      proteinaImagenes={media.proteinaImagenes}
                    />
                  </div>
                </div>
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
