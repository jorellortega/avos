import { NextResponse } from "next/server"
import { isManagerOrCeo } from "@/lib/profile-types"
import { createServerSupabase } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

/**
 * Deletes an avos_orders row (cocina). Manager and CEO only.
 */
export async function POST(request: Request) {
  let body: { orderId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const orderId = body.orderId?.trim()
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isManagerOrCeo(profile?.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 })
  }

  const service = createServiceRoleClient()
  const { data: deleted, error: delErr } = await service
    .from("avos_orders")
    .delete()
    .eq("id", orderId)
    .select("id")

  if (delErr) {
    console.error("[kitchen/delete-order]", delErr.message)
    return NextResponse.json({ error: "delete failed" }, { status: 500 })
  }
  if (!deleted?.length) {
    return NextResponse.json({ error: "order not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
