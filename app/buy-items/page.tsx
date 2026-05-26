import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BuyItemsClient } from "@/components/buy-items-client"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isStaffOrdersRole } from "@/lib/profile-types"

export const metadata: Metadata = {
  title: "Lista de compras | Avos",
  description: "Escanear o armar lista de artículos para comprar.",
  robots: { index: false, follow: false },
}

export default async function BuyItemsPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/buy-items")
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-10">
        <div className="container mx-auto px-4 max-w-2xl">
          <BuyItemsClient />
        </div>
      </main>
      <Footer />
    </div>
  )
}
