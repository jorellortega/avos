import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { DeliveryZonesEditor } from "@/components/delivery-zones-editor"
import { createServerSupabase } from "@/lib/supabase/server"
import { getDeliveryZones } from "@/lib/get-delivery-zones"
import type { StaffProfile } from "@/lib/profile-types"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Tarifas de domicilio | Avos",
  description: "Editar zonas y costos de envío en Pastor Ortiz (CEO).",
  robots: { index: false, follow: false },
}

export default async function DeliveryZonesEditPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/delivery-zones-edit")
  }

  let { data: profileRow } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRow == null) {
    await supabase.rpc("ensure_my_public_user")
    const second = await supabase
      .from("users")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle()
    profileRow = second.data
  }

  const profile = profileRow as StaffProfile | null
  if (!profile || profile.role !== "ceo") {
    redirect("/staff/dashboard")
  }

  const zones = await getDeliveryZones()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4">
          <DeliveryZonesEditor initial={zones} />
          <p className="text-center text-xs text-muted-foreground mt-8">
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
