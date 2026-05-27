import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MenuPageGrid } from "@/components/menu-page-grid"
import { getSiteMedia } from "@/lib/get-site-media"

export const revalidate = 30

export default async function MenuPage() {
  const media = await getSiteMedia()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-4">
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Nuestro menú
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toca una foto para ordenar
          </p>
        </section>

        <section className="py-3 px-2 sm:px-4">
          <div className="mx-auto w-full max-w-5xl">
            <MenuPageGrid media={media} />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
