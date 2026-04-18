import { NextResponse } from "next/server"
import { getStripe, isStripeConfigured } from "@/lib/stripe"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

type Body = {
  orderId?: string
}

type OrderItemRow = {
  nombre?: string
  cantidad?: number
  precio?: number
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "El pago en línea no está disponible en este momento. Intenta más tarde o contacta al restaurante.",
      },
      { status: 503 },
    )
  }

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const orderId = body.orderId?.trim()
  if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json({ error: "Orden inválida" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: row, error } = await supabase
    .from("avos_orders")
    .select("id,numero,total,status,order_type,paid_at,items,nombre_cliente")
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[checkout/order]", error.message)
    return NextResponse.json({ error: "No se pudo cargar la orden" }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })
  }
  if (row.order_type !== "pickup") {
    return NextResponse.json(
      { error: "Solo pedidos para llevar pueden pagarse en línea desde aquí." },
      { status: 400 },
    )
  }
  if (row.status !== "pendiente" || row.paid_at) {
    return NextResponse.json(
      { error: "Esta orden ya no está pendiente de pago." },
      { status: 400 },
    )
  }

  const items = row.items as unknown
  if (!Array.isArray(items) || items.length < 1) {
    return NextResponse.json({ error: "La orden no tiene artículos" }, { status: 400 })
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"

  const stripe = getStripe()
  const line_items: {
    quantity: number
    price_data: {
      currency: "mxn"
      product_data: { name: string }
      unit_amount: number
    }
  }[] = []

  for (const raw of items) {
    const item = raw as OrderItemRow
    const nombre = typeof item.nombre === "string" ? item.nombre : "Artículo"
    const cantidad = Math.max(1, Math.floor(Number(item.cantidad) || 1))
    const unit_amount = Math.round(Number(item.precio) * 100)
    if (!Number.isFinite(unit_amount) || unit_amount < 1) {
      return NextResponse.json({ error: "Precio inválido en la orden" }, { status: 400 })
    }
    line_items.push({
      quantity: cantidad,
      price_data: {
        currency: "mxn",
        product_data: {
          name: nombre.slice(0, 120),
        },
        unit_amount,
      },
    })
  }

  const expectedTotal = Number(row.total)
  const sumCents = line_items.reduce(
    (acc, li) => acc + (li.price_data?.unit_amount ?? 0) * (li.quantity ?? 1),
    0,
  )
  if (Math.abs(sumCents - Math.round(expectedTotal * 100)) > 1) {
    console.error("[checkout/order] total mismatch", { sumCents, expected: expectedTotal })
    return NextResponse.json(
      { error: "El total del pedido no coincide. Actualiza la página e intenta de nuevo." },
      { status: 409 },
    )
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/orden/${row.numero}`,
      metadata: {
        avos_order_id: row.id,
        avos_order_numero: String(row.numero),
        avos_flow: "order_pay",
      },
      locale: "es",
    })

    if (!session.url) {
      return NextResponse.json({ error: "No se pudo crear la sesión de pago" }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error("[checkout/order]", e)
    return NextResponse.json(
      { error: "Error al iniciar el pago. Intenta de nuevo." },
      { status: 500 },
    )
  }
}
