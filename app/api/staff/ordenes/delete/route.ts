import { NextResponse } from "next/server"
import { requireCeo } from "@/lib/require-ceo"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

/** CEO-only: delete an avos_orders row from staff/ordenes. */
export async function POST(request: Request) {
  const ceo = await requireCeo()
  if ("error" in ceo && ceo.error) return ceo.error

  let body: { orderId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const orderId = body.orderId?.trim()
  if (!orderId) {
    return NextResponse.json({ error: "orderId requerido." }, { status: 400 })
  }

  const service = createServiceRoleClient()
  const { data: deleted, error: delErr } = await service
    .from("avos_orders")
    .delete()
    .eq("id", orderId)
    .select("id")

  if (delErr) {
    console.error("[staff/ordenes/delete]", delErr.message)
    return NextResponse.json({ error: "No se pudo eliminar." }, { status: 500 })
  }
  if (!deleted?.length) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
