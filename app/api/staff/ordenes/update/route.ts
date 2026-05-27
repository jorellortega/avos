import { NextResponse } from "next/server"
import { requireCeo } from "@/lib/require-ceo"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

const STATUSES = new Set([
  "pendiente",
  "preparando",
  "listo",
  "entregado",
  "pagado",
])

const ORDER_TYPES = new Set(["mesa", "pickup", "domicilio"])

const PAYMENT_METHODS = new Set(["efectivo", "tarjeta", "caja"])

type UpdateBody = {
  orderId?: string
  total?: number
  status?: string
  order_type?: string
  mesa?: string | null
  nombre_cliente?: string | null
  payment_method?: string | null
  paid_at?: string | null
  delivery_address?: string | null
  delivery_zone_id?: string | null
  delivery_fee?: number | null
}

/** CEO-only: patch avos_orders fields from staff/ordenes. */
export async function PATCH(request: Request) {
  const ceo = await requireCeo()
  if ("error" in ceo && ceo.error) return ceo.error

  let body: UpdateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const orderId = body.orderId?.trim()
  if (!orderId) {
    return NextResponse.json({ error: "orderId requerido." }, { status: 400 })
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.total !== undefined) {
    const total = Number(body.total)
    if (!Number.isFinite(total) || total <= 0 || total > 100000) {
      return NextResponse.json({ error: "Total no válido." }, { status: 400 })
    }
    patch.total = total
  }

  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Estado no válido." }, { status: 400 })
    }
    patch.status = body.status
  }

  if (body.order_type !== undefined) {
    if (!ORDER_TYPES.has(body.order_type)) {
      return NextResponse.json({ error: "Tipo no válido." }, { status: 400 })
    }
    patch.order_type = body.order_type
  }

  if (body.mesa !== undefined) {
    const m = body.mesa?.trim() ?? ""
    patch.mesa = m ? m : null
  }

  if (body.nombre_cliente !== undefined) {
    const n = body.nombre_cliente?.trim() ?? ""
    patch.nombre_cliente = n ? n : null
  }

  if (body.payment_method !== undefined) {
    if (body.payment_method === null || body.payment_method === "") {
      patch.payment_method = null
    } else if (PAYMENT_METHODS.has(body.payment_method)) {
      patch.payment_method = body.payment_method
    } else {
      return NextResponse.json({ error: "Método de pago no válido." }, { status: 400 })
    }
  }

  if (body.paid_at !== undefined) {
    if (body.paid_at === null || body.paid_at === "") {
      patch.paid_at = null
    } else {
      const d = new Date(body.paid_at)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Fecha de pago no válida." }, { status: 400 })
      }
      patch.paid_at = d.toISOString()
    }
  }

  if (body.delivery_address !== undefined) {
    const a = body.delivery_address?.trim() ?? ""
    patch.delivery_address = a ? a : null
  }

  if (body.delivery_zone_id !== undefined) {
    const z = body.delivery_zone_id?.trim() ?? ""
    patch.delivery_zone_id = z ? z : null
  }

  if (body.delivery_fee !== undefined) {
    if (body.delivery_fee === null) {
      patch.delivery_fee = null
    } else {
      const fee = Number(body.delivery_fee)
      if (!Number.isFinite(fee) || fee < 0 || fee > 10000) {
        return NextResponse.json({ error: "Envío no válido." }, { status: 400 })
      }
      patch.delivery_fee = fee
    }
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 })
  }

  const service = createServiceRoleClient()
  const { data, error } = await service
    .from("avos_orders")
    .update(patch)
    .eq("id", orderId)
    .select(
      "id,numero,total,status,order_type,mesa,nombre_cliente,payment_method,paid_at",
    )
    .maybeSingle()

  if (error) {
    console.error("[staff/ordenes/update]", error.message)
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, order: data })
}
