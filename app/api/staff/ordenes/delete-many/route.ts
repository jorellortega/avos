import { NextResponse } from "next/server"
import { requireCeo } from "@/lib/require-ceo"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

const MAX_BATCH = 50

/** CEO-only: delete multiple avos_orders rows. */
export async function POST(request: Request) {
  const ceo = await requireCeo()
  if ("error" in ceo && ceo.error) return ceo.error

  let body: { orderIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const orderIds = Array.isArray(body.orderIds)
    ? [...new Set(body.orderIds.map((id) => String(id).trim()).filter(Boolean))]
    : []

  if (orderIds.length === 0) {
    return NextResponse.json(
      { error: "Selecciona al menos una orden." },
      { status: 400 },
    )
  }
  if (orderIds.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Máximo ${MAX_BATCH} órdenes por vez.` },
      { status: 400 },
    )
  }

  const service = createServiceRoleClient()
  const { data: deleted, error: delErr } = await service
    .from("avos_orders")
    .delete()
    .in("id", orderIds)
    .select("id")

  if (delErr) {
    console.error("[staff/ordenes/delete-many]", delErr.message)
    return NextResponse.json({ error: "No se pudo eliminar." }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    deleted: deleted?.length ?? 0,
  })
}
