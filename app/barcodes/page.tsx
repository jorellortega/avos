import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BarcodesManager } from "@/components/barcodes-manager"
import { createServerSupabase } from "@/lib/supabase/server"
import { getSiteBaseUrl } from "@/lib/site-base-url"
import type { StaffProfile } from "@/lib/profile-types"
import { isManagerOrCeo } from "@/lib/profile-types"
import type { SiteBarcodeRow } from "@/lib/site-barcodes-types"

export const metadata: Metadata = {
  title: "Códigos QR | Avos",
  description: "Gestionar códigos QR para el sitio y promociones (manager y CEO).",
  robots: { index: false, follow: false },
}

export default async function BarcodesPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/barcodes")
  }

  const first = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  let profileRow = first.data

  if (user && profileRow == null) {
    await supabase.rpc("ensure_my_public_user")
    const second = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
    profileRow = second.data
  }

  const profile = profileRow as StaffProfile | null

  if (!profile || !isManagerOrCeo(profile.role)) {
    redirect("/staff/dashboard")
  }

  const baseUrl = await getSiteBaseUrl()

  const { data: barcodeRows, error: barcodesError } = await supabase
    .from("site_barcodes")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  const initialRows = (barcodeRows ?? []) as SiteBarcodeRow[]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-8">
            <h1
              className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Códigos QR
            </h1>
            <p className="text-muted-foreground mt-2">
              Origen del sitio para los enlaces:{" "}
              <span className="font-mono text-sm text-foreground">{baseUrl}</span>
            </p>
          </div>

          {barcodesError ? (
            <p className="text-destructive text-sm border border-destructive/30 rounded-md px-3 py-2 bg-destructive/10">
              No se pudieron cargar los códigos ({barcodesError.message}). ¿Aplicaste la migración{" "}
              <code className="text-xs">site_barcodes</code> en Supabase?
            </p>
          ) : (
            <BarcodesManager baseUrl={baseUrl} initialRows={initialRows} />
          )}

          <p className="text-center text-xs text-muted-foreground mt-12">
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
