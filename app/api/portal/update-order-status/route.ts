import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { requirePortalStaff } from "@/lib/portal-ai-request"
import type { OrderStatus } from "@/components/orders-provider"

const ALLOWED: OrderStatus[] = [
  "pendiente",
  "preparando",
  "listo",
  "entregado",
  "pagado",
]

export async function POST(req: Request) {
  const staff = await requirePortalStaff()
  if ("error" in staff && staff.error) return staff.error

  let body: { orderId?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const orderId = body.orderId?.trim()
  const status = body.status?.trim() as OrderStatus | undefined

  if (!orderId) {
    return NextResponse.json({ error: "Falta el id de la orden." }, { status: 400 })
  }
  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Estado no válido." }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: updated, error } = await supabase
    .from("avos_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("id, status")

  if (error) {
    console.error("[portal/update-order-status]", error.message)
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 })
  }
  if (!updated?.length) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, status: updated[0].status })
}
