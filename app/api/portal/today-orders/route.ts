import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { isStaffOrdersRole } from "@/lib/profile-types"
import {
  mapAvosOrderRowToOrder,
  startOfTodayUtcRange,
  type AvosOrderDbRow,
} from "@/lib/portal-today-orders"

export const runtime = "nodejs"

export async function GET() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión de personal." }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || !isStaffOrdersRole(profile.role)) {
    return NextResponse.json({ error: "Sin permiso de personal." }, { status: 403 })
  }

  const { from, to } = startOfTodayUtcRange()
  const { data: rows, error } = await supabase
    .from("avos_orders")
    .select(
      "id,numero,total,status,order_type,mesa,nombre_cliente,items,created_at,updated_at,delivery_zone_id,delivery_fee,delivery_address,delivery_photo_street_url,delivery_photo_house_url,extra_charge,discount_amount,discount_preset,discount_percent",
    )
    .gte("created_at", from)
    .lt("created_at", to)
    .order("numero", { ascending: false })

  if (error) {
    console.error("[portal/today-orders]", error.message)
    return NextResponse.json({ error: "No se pudieron cargar órdenes." }, { status: 500 })
  }

  const orders = (rows ?? [])
    .map((row) => mapAvosOrderRowToOrder(row as AvosOrderDbRow))
    .filter((o): o is NonNullable<typeof o> => o != null)

  return NextResponse.json({ orders })
}
