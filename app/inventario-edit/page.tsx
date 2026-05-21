import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { InventarioEditDashboard } from "@/components/inventario-edit-dashboard"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isManagerOrCeo } from "@/lib/profile-types"
import type { InventoryItemRow } from "@/lib/inventario-types"

export const metadata: Metadata = {
  title: "Inventario | Avos",
  description: "Control de inventario (manager / CEO).",
  robots: { index: false, follow: false },
}

export default async function InventarioEditPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/inventario-edit")
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

  const { data: itemRows, error: itemsError } = await supabase
    .from("inventory_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  const initialItems = (itemRows ?? []) as InventoryItemRow[]

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
              Inventario
            </h1>
            <p className="text-muted-foreground mt-2">
              Productos por categoría (tomates, especias, proteínas…).
            </p>
          </div>

          {itemsError ? (
            <p className="text-destructive text-sm border border-destructive/30 rounded-md px-3 py-2 bg-destructive/10">
              No se pudo cargar el inventario ({itemsError.message}). ¿Aplicaste la
              migración <code className="text-xs">inventory_items</code> en Supabase?
            </p>
          ) : (
            <InventarioEditDashboard initialItems={initialItems} />
          )}

          <p className="text-center text-xs text-muted-foreground">
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
