import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProveedoresDashboard } from "@/components/proveedores-dashboard"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isManagerOrCeo } from "@/lib/profile-types"
import type { SupplierRow } from "@/lib/proveedores-types"

export const metadata: Metadata = {
  title: "Proveedores | Avos",
  description: "Directorio de proveedores (manager / CEO).",
  robots: { index: false, follow: false },
}

export default async function ProveedoresPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/proveedores")
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
  if (!profile || !isManagerOrCeo(profile.role)) {
    redirect("/staff/dashboard")
  }

  const { data: supplierRows, error: suppliersError } = await supabase
    .from("suppliers")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  const initialSuppliers = (supplierRows ?? []) as SupplierRow[]

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
              Proveedores
            </h1>
            <p className="text-muted-foreground mt-2">
              Contactos, tipo de producto y precios de referencia para compras.
            </p>
          </div>

          {suppliersError ? (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              No se pudo cargar la lista ({suppliersError.message}). ¿Corriste la
              migración{" "}
              <code className="text-xs">suppliers</code> en Supabase?
            </p>
          ) : (
            <ProveedoresDashboard initialSuppliers={initialSuppliers} />
          )}

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/staff/dashboard" className="underline underline-offset-2">
              Panel de personal
            </Link>
            {" · "}
            <Link href="/inventario-edit" className="underline underline-offset-2">
              Inventario
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
