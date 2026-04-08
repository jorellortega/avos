import Link from "next/link"
import Image from "next/image"
import { Utensils, ShoppingBag } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { categorias } from "@/lib/menu-data"

const categoriaEmoji: Record<string, string> = {
  tacos: "🌮",
  tortas: "🥪",
  burritos: "🌯",
  quesadillas: "🧀",
  platillos: "🍽️",
}

export default function HomePage() {
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
                    style={{ fontFamily: 'var(--font-heading)' }}
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
                <div className="aspect-square relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png"
                    alt="Deliciosos tacos con aguacate y carne asada"
                    fill
                    className="object-cover object-top"
                    priority
                  />
                </div>
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
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Nuestro Menú
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Desde tacos hasta platillos completos, tenemos algo para todos. 
                Elige tu proteína favorita: Asada, Pollo, Pastor o Camarón.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              {categorias.map((categoria) => (
                <Link
                  key={categoria.id}
                  href={`/menu/${categoria.id}`}
                  className="bg-card rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 block cursor-pointer"
                >
                  <div className="text-5xl mb-3" aria-hidden>
                    {categoriaEmoji[categoria.id] ?? "🍴"}
                  </div>
                  <h3 className="font-semibold text-foreground">
                    {categoria.nombre}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
