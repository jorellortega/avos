import { NextResponse } from "next/server"
import { requireCeo } from "@/lib/require-ceo"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

/** CEO-only: full order row for edit dialog. */
export async function GET(request: Request) {
  const ceo = await requireCeo()
  if ("error" in ceo && ceo.error) return ceo.error

  const orderId = new URL(request.url).searchParams.get("orderId")?.trim()
  if (!orderId) {
    return NextResponse.json({ error: "orderId requerido." }, { status: 400 })
  }

  const service = createServiceRoleClient()
  const { data, error } = await service
    .from("avos_orders")
    .select(
      "id,numero,total,status,order_type,mesa,nombre_cliente,payment_method,paid_at,created_at,items,delivery_zone_id,delivery_address,delivery_fee",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[staff/ordenes/detail]", error.message)
    return NextResponse.json({ error: "No se pudo cargar." }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 })
  }

  return NextResponse.json({ order: data })
}
