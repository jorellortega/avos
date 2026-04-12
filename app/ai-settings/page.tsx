import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AiSettingsPanel } from "@/components/ai-settings-panel"
import { createServerSupabase } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Ajustes de IA | Avos",
  description: "Configuración de proveedores de IA (solo CEO).",
  robots: { index: false, follow: false },
}

export default async function AiSettingsPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/ai-settings")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4">
          <AiSettingsPanel />
          <p className="text-center text-xs text-muted-foreground mt-8">
            <Link href="/" className="underline underline-offset-2">
              Volver al inicio
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
