import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SiteMediaEditor } from "@/components/site-media-editor"
import { createServerSupabase } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Editar sitio | Avos",
  description: "Imágenes del inicio y del menú (solo CEO).",
  robots: { index: false, follow: false },
}

export default async function EditSitePage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/edit")
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "ceo") {
    redirect("/staff/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4">
          <SiteMediaEditor serverVerifiedCeo />
          <p className="text-center text-xs text-muted-foreground mt-10">
            <Link href="/staff/dashboard" className="underline underline-offset-2">
              Volver al panel
            </Link>
            {" · "}
            <Link href="/" className="underline underline-offset-2">
              Inicio
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
