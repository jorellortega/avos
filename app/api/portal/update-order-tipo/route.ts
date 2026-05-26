import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { requirePortalStaff } from "@/lib/portal-ai-request"
import type { OrderType } from "@/components/orders-provider"

const ALLOWED: OrderType[] = ["mesa", "pickup", "domicilio"]

export async function POST(req: Request) {
  const staff = await requirePortalStaff()
  if ("error" in staff && staff.error) return staff.error

  let body: { orderId?: string; tipo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const orderId = body.orderId?.trim()
  const tipo = body.tipo?.trim() as OrderType | undefined

  if (!orderId) {
    return NextResponse.json({ error: "Falta el id de la orden." }, { status: 400 })
  }
  if (!tipo || !ALLOWED.includes(tipo)) {
    return NextResponse.json({ error: "Tipo no válido." }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: updated, error } = await supabase
    .from("avos_orders")
    .update({ order_type: tipo, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("id, order_type")

  if (error) {
    console.error("[portal/update-order-tipo]", error.message)
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 })
  }
  if (!updated?.length) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, tipo: updated[0].order_type })
}
