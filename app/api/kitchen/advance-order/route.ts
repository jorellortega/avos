import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

const NEXT: Record<string, string> = {
  pendiente: "preparando",
  pagado: "preparando",
  preparando: "listo",
  listo: "entregado",
}

/**
 * Advances avos_orders status for the kitchen display (cocina).
 * Uses service role; same device typically has the order in localStorage + DB.
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

  const supabase = createServiceRoleClient()
  const { data: row, error: selErr } = await supabase
    .from("avos_orders")
    .select("id,status")
    .eq("id", orderId)
    .maybeSingle()

  if (selErr) {
    console.error("[kitchen/advance-order]", selErr.message)
    return NextResponse.json({ error: "lookup failed" }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "order not found" }, { status: 404 })
  }

  const cur = row.status as string
  const next = NEXT[cur]
  if (!next) {
    return NextResponse.json(
      { error: `No se puede avanzar desde el estado: ${cur}` },
      { status: 400 },
    )
  }

  const { data: updated, error: upErr } = await supabase
    .from("avos_orders")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", cur)
    .select("id")

  if (upErr) {
    console.error("[kitchen/advance-order] update", upErr.message)
    return NextResponse.json({ error: "update failed" }, { status: 500 })
  }
  if (!updated?.length) {
    return NextResponse.json(
      { error: "El estado cambió o ya se actualizó. Actualiza la pantalla." },
      { status: 409 },
    )
  }

  return NextResponse.json({ ok: true, status: next })
}
