import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"

export async function requireCeo() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: "Inicia sesión." }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "ceo") {
    return {
      error: NextResponse.json({ error: "Solo el CEO puede acceder." }, { status: 403 }),
    }
  }

  return { user }
}
