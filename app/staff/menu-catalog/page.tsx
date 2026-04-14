import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MenuCatalogEditor } from "@/components/menu-catalog-editor"
import { createServerSupabase } from "@/lib/supabase/server"
import { getMenuCatalog } from "@/lib/get-menu-catalog"
import { isStaffOrdersRole } from "@/lib/profile-types"
import type { StaffProfile } from "@/lib/profile-types"

export const dynamic = "force-dynamic"

export default async function StaffMenuCatalogPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/staff/menu-catalog")
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

  if (!profile || !isStaffOrdersRole(profile.role)) {
    redirect("/staff/dashboard")
  }

  const catalog = await getMenuCatalog()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4">
          <MenuCatalogEditor initial={catalog.json} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
