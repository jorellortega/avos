import Image from "next/image"
import Link from "next/link"
import { Utensils, ShoppingBag } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HeroSlideshow } from "@/components/hero-slideshow"
import { HomeAiChat } from "@/components/home-ai-chat"
import { Button } from "@/components/ui/button"
import { categorias } from "@/lib/menu-data"
import { getSiteMedia } from "@/lib/get-site-media"

export const revalidate = 30

const categoriaEmoji: Record<string, string> = {
  tacos: "🌮",
  tortas: "🥪",
  burritos: "🌯",
  quesadillas: "🧀",
  platillos: "🍽️",
}

export default async function HomePage() {
  const media = await getSiteMedia()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-primary/5 overflow-hidden">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-8">
                <div className="text-center lg:text-left">
                  <h1
                    className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Bienvenido a <span className="text-primary">Avos</span>
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    ¿Cómo deseas ordenar hoy?
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/comer-aqui" className="flex-1">
                    <Button size="lg" className="w-full h-auto py-6 text-lg flex flex-col gap-2">
                      <Utensils className="h-8 w-8" />
                      Comer Aquí
                    </Button>
                  </Link>
                  <Link href="/para-llevar" className="flex-1">
                    <Button variant="outline" size="lg" className="w-full h-auto py-6 text-lg flex flex-col gap-2 border-2">
                      <ShoppingBag className="h-8 w-8" />
                      Para Llevar
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="relative">
                <HeroSlideshow slides={media.heroSlides} />
              </div>
            </div>
          </div>
        </section>

        {/* Menu Preview */}
        <section className="py-16 md:py-24 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2
                className="text-3xl md:text-4xl font-bold text-foreground mb-4"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Nuestro Menú
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Desde tacos hasta platillos completos, tenemos algo para todos.
                Elige tu proteína favorita: Asada, Pollo, Pastor o Camarón.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              {categorias.map((categoria) => {
                const thumb =
                  media.categoriaImagenes[categoria.id] ?? categoria.imagen
                return (
                  <Link
                    key={categoria.id}
                    href={`/menu/${categoria.id}`}
                    className="bg-card rounded-2xl p-4 md:p-6 text-center shadow-sm hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 block cursor-pointer overflow-hidden"
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
            </div>
          </div>
        </section>

        {/* AI assistant — below menu categories */}
        <section className="border-t border-border bg-secondary/20 py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-3xl">
            <HomeAiChat />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
