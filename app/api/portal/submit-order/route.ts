import { NextResponse } from "next/server"
import type { Order, OrderItem } from "@/components/orders-provider"
import { createServerSupabase } from "@/lib/supabase/server"
import { isStaffOrdersRole } from "@/lib/profile-types"

function isMissingInsertAvosOrderOverload(err: { message?: string }): boolean {
  const m = err.message ?? ""
  return (
    m.includes("Could not find the function") && m.includes("insert_avos_order")
  )
}

async function requireStaff() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Inicia sesión de personal." }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile || !isStaffOrdersRole(profile.role)) {
    return { error: NextResponse.json({ error: "Sin permiso de personal." }, { status: 403 }) }
  }
  return { supabase, user }
}

export async function POST(req: Request) {
  const staff = await requireStaff()
  if ("error" in staff && staff.error) return staff.error
  const { supabase, user } = staff

  let body: {
    action?: "insert" | "update_cart"
    order?: Order
    orderId?: string
    items?: OrderItem[]
    total?: number
    extraCharge?: number
    discountAmount?: number
    discountPreset?: string | null
    discountPercent?: number | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  if (body.action === "update_cart") {
    const orderId = body.orderId
    const items = body.items
    const total = body.total
    const extraCharge =
      typeof body.extraCharge === "number" && body.extraCharge >= 0
        ? body.extraCharge
        : 0
    const discountAmount =
      typeof body.discountAmount === "number" && body.discountAmount >= 0
        ? body.discountAmount
        : 0
    const discountPreset =
      body.discountPreset === "employee_20" ||
      body.discountPreset === "employee_meal"
        ? body.discountPreset
        : null
    const discountPercent =
      typeof body.discountPercent === "number" && body.discountPercent >= 0
        ? Math.min(100, body.discountPercent)
        : null
    if (!orderId || !Array.isArray(items) || typeof total !== "number") {
      return NextResponse.json({ error: "Datos incompletos." }, { status: 400 })
    }
    const { error } = await supabase.rpc("customer_update_avos_order_cart", {
      p_id: orderId,
      p_items: items,
      p_total: total,
      p_extra_charge: extraCharge,
      p_discount_amount: discountAmount,
      p_discount_preset: discountPreset,
      p_discount_percent: discountPercent,
    })
    if (error) {
      console.error("portal submit-order update_cart", error.message)
      return NextResponse.json(
        { error: error.message || "No se pudo guardar el carrito." },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok: true })
  }

  const order = body.order
  if (!order?.id || !Array.isArray(order.items) || order.items.length === 0) {
    return NextResponse.json({ error: "Orden no válida." }, { status: 400 })
  }

  const basePayload = {
    p_id: order.id,
    p_numero: order.numero,
    p_total: order.total,
    p_status: order.status,
    p_order_type: order.tipo,
    p_mesa: order.mesa ?? null,
    p_nombre_cliente: order.nombreCliente ?? null,
    p_items: order.items,
  }

  const payload = {
    ...basePayload,
    p_customer_user_id: user.id,
    p_delivery_zone_id: order.deliveryZoneId ?? null,
    p_delivery_fee: order.deliveryFee ?? null,
    p_delivery_address: order.deliveryAddress ?? null,
    p_delivery_photo_street_url: order.deliveryPhotoStreetUrl ?? null,
    p_delivery_photo_house_url: order.deliveryPhotoHouseUrl ?? null,
    p_extra_charge: order.extraCharge ?? 0,
    p_discount_amount: order.discountAmount ?? 0,
    p_discount_preset: order.discountPreset ?? null,
    p_discount_percent: order.discountPercent ?? null,
  }

  let { error } = await supabase.rpc("insert_avos_order", payload)

  if (error && isMissingInsertAvosOrderOverload(error)) {
    ;({ error } = await supabase.rpc("insert_avos_order", basePayload))
  }

  if (error) {
    const msg = error.message ?? ""
    if (msg.toLowerCase().includes("ordering_disabled")) {
      return NextResponse.json(
        { error: "Los pedidos en línea están desactivados." },
        { status: 403 },
      )
    }
    console.error("portal submit-order insert", msg)
    return NextResponse.json(
      { error: msg || "No se pudo guardar la orden." },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
