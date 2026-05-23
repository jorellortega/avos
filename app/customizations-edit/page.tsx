import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { OrderCustomizationsEditor } from "@/components/order-customizations-editor"
import { createServerSupabase } from "@/lib/supabase/server"
import { getOrderCustomizations } from "@/lib/get-order-customizations"
import { isStaffOrdersRole } from "@/lib/profile-types"
import type { StaffProfile } from "@/lib/profile-types"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Personalización de pedidos | Avos",
  description: "Editar opciones Con todo / Sin… por platillo.",
  robots: { index: false, follow: false },
}

export default async function CustomizationsEditPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/customizations-edit")
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

  const { json } = await getOrderCustomizations()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4">
          <OrderCustomizationsEditor initial={json} />
          <p className="text-center text-xs text-muted-foreground mt-8">
            <Link href="/staff/menu-catalog" className="underline underline-offset-2">
              Precios y disponibilidad
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
