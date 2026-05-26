import { NextResponse } from "next/server"
import { isStaffOrdersRole } from "@/lib/profile-types"
import { createServerSupabase } from "@/lib/supabase/server"

export async function requireStaffOrders() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: "Inicia sesión de personal." }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || !isStaffOrdersRole(profile.role)) {
    return {
      error: NextResponse.json({ error: "Sin permiso de personal." }, { status: 403 }),
    }
  }

  return { user, profile }
}
