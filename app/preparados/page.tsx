import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PreparadosDashboard } from "@/components/preparados-dashboard"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isStaffOrdersRole } from "@/lib/profile-types"
import type { PrepReadyItemRow } from "@/lib/preparados-types"

export const metadata: Metadata = {
  title: "Preparados | Avos",
  description: "Lista de preparados listos (congelado, caliente, frío).",
  robots: { index: false, follow: false },
}

export default async function PreparadosPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/preparados")
  }

  let { data: profileRow } = await supabase
    .from("users")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRow == null) {
    await supabase.rpc("ensure_my_public_user")
    const second = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .maybeSingle()
    profileRow = second.data
  }

  const profile = profileRow as StaffProfile | null
  if (!profile || !isStaffOrdersRole(profile.role)) {
    redirect("/staff/dashboard")
  }

  const { data: rows, error: loadError } = await supabase
    .from("prep_ready_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  const initialItems = (rows ?? []) as PrepReadyItemRow[]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-5xl space-y-6">
          <div>
            <h1
              className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Preparados
            </h1>
            <p className="text-muted-foreground mt-2">
              Salsas, frijoles, arroz, bebidas y más — marca si están congelados,
              calientes o fríos.
            </p>
          </div>

          {loadError ? (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              No se pudo cargar ({loadError.message}). ¿Corriste la migración{" "}
              <code className="text-xs">prep_ready_items</code> en Supabase?
            </p>
          ) : (
            <PreparadosDashboard initialItems={initialItems} />
          )}

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/cocina" className="underline underline-offset-2">
              Cocina
            </Link>
            {" · "}
            <Link href="/inventario-edit" className="underline underline-offset-2">
              Inventario
            </Link>
            {" · "}
            <Link href="/staff/dashboard" className="underline underline-offset-2">
              Panel de personal
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
