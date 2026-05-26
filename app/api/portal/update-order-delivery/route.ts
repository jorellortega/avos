import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { requirePortalStaff } from "@/lib/portal-ai-request"

export async function POST(req: Request) {
  const staff = await requirePortalStaff()
  if ("error" in staff && staff.error) return staff.error

  let body: {
    orderId?: string
    deliveryZoneId?: string
    deliveryZoneLabel?: string
    deliveryFee?: number
    deliveryAddress?: string
    total?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const orderId = body.orderId?.trim()
  const deliveryZoneId = body.deliveryZoneId?.trim()
  const deliveryAddress = body.deliveryAddress?.trim()

  if (!orderId) {
    return NextResponse.json({ error: "Falta el id de la orden." }, { status: 400 })
  }
  if (!deliveryZoneId || !deliveryAddress) {
    return NextResponse.json(
      { error: "Elige zona y dirección de entrega." },
      { status: 400 },
    )
  }

  const deliveryFee =
    typeof body.deliveryFee === "number" && body.deliveryFee >= 0
      ? body.deliveryFee
      : 0

  const patch: Record<string, unknown> = {
    order_type: "domicilio",
    delivery_zone_id: deliveryZoneId,
    delivery_address: deliveryAddress,
    delivery_fee: deliveryFee,
    updated_at: new Date().toISOString(),
  }
  if (typeof body.total === "number") {
    patch.total = body.total
  }

  const supabase = createServiceRoleClient()
  const { data: updated, error } = await supabase
    .from("avos_orders")
    .update(patch)
    .eq("id", orderId)
    .select("id, delivery_zone_id, delivery_address, delivery_fee, total")

  if (error) {
    console.error("[portal/update-order-delivery]", error.message)
    return NextResponse.json({ error: "No se pudo guardar la entrega." }, { status: 500 })
  }
  if (!updated?.length) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    deliveryZoneId: updated[0].delivery_zone_id,
    deliveryAddress: updated[0].delivery_address,
    deliveryFee: updated[0].delivery_fee,
    total: updated[0].total,
  })
}
