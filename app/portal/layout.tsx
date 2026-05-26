import { redirect } from "next/navigation"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isStaffOrdersRole } from "@/lib/profile-types"

/**
 * Portal de caja (/portal): toma de pedidos y cobro — staff, manager y CEO.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/portal")
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

  return <>{children}</>
}
