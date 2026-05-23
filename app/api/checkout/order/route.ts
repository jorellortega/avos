import { NextResponse } from "next/server"
import {
  checkoutOrderSummary,
  checkoutOrderVerbose,
} from "@/lib/checkout-order-debug"
import { menuPesosMxnToStripeUnitAmount } from "@/lib/mxn-stripe"
import { getStripe, isStripeConfigured } from "@/lib/stripe"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

type Body = {
  orderId?: string
  /**
   * `staff_pos`: cancel → /staff, success → checkout/success with ?from=staff (Crear orden en mostrador).
   * Omit for flujo cliente (cancel → /orden/:n).
   */
  context?: string
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
  const staffPos = body.context === "staff_pos"
  if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json({ error: "Orden inválida" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  if (!staffPos) {
    try {
      const { data } = await supabase
        .from("ordering_settings")
        .select("ordering_enabled, closed_message")
        .eq("id", 1)
        .maybeSingle()
      if (data && data.ordering_enabled === false) {
        return NextResponse.json(
          {
            error:
              data.closed_message?.trim() ||
              "En este momento no estamos aceptando pedidos en línea. Intenta más tarde.",
          },
          { status: 503 },
        )
      }
    } catch {
      // If settings lookup fails, don't block checkout.
    }
  }
  const { data: row, error } = await supabase
    .from("avos_orders")
    .select(
      "id,numero,total,status,order_type,paid_at,items,nombre_cliente,delivery_fee,delivery_zone_id",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[checkout/order]", error.message)
    return NextResponse.json({ error: "No se pudo cargar la orden" }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })
  }
  if (
    row.order_type !== "pickup" &&
    row.order_type !== "mesa" &&
    row.order_type !== "domicilio"
  ) {
    return NextResponse.json(
      { error: "Este tipo de pedido no puede pagarse en línea desde aquí." },
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

  checkoutOrderSummary({
    phase: "loaded",
    orderIdPrefix: orderId.slice(0, 8),
    numero: row.numero,
    orderType: row.order_type,
    staffPos,
    dbTotal: row.total,
    dbTotalNum: Number(row.total),
    itemRowCount: items.length,
  })

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
    const precioRaw = item.precio
    const precioNum = Number(precioRaw)
    const conv = menuPesosMxnToStripeUnitAmount(precioNum)
    if (!conv.ok) {
      console.error("[checkout/order] precio inválido", {
        reason: conv.reason,
        precioRaw,
        precioNum,
        nombre: nombre.slice(0, 80),
        cantidad,
      })
      return NextResponse.json(
        {
          error:
            "Hay un precio inválido en la orden. Contacta al restaurante o actualiza la página.",
        },
        { status: 400 },
      )
    }
    const unit_amount = conv.stripeUnitAmount
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

  const deliveryFee = Number(row.delivery_fee)
  if (Number.isFinite(deliveryFee) && deliveryFee > 0) {
    const conv = menuPesosMxnToStripeUnitAmount(deliveryFee)
    if (!conv.ok) {
      return NextResponse.json({ error: "Tarifa de envío inválida." }, { status: 400 })
    }
    line_items.push({
      quantity: 1,
      price_data: {
        currency: "mxn",
        product_data: {
          name: `Envío a domicilio${row.delivery_zone_id ? ` (${String(row.delivery_zone_id)})` : ""}`.slice(
            0,
            120,
          ),
        },
        unit_amount: conv.stripeUnitAmount,
      },
    })
  }

  const expectedTotal = Number(row.total)
  const sumCents = line_items.reduce(
    (acc, li) => acc + (li.price_data?.unit_amount ?? 0) * (li.quantity ?? 1),
    0,
  )
  if (Math.abs(sumCents - Math.round(expectedTotal * 100)) > 1) {
    checkoutOrderVerbose("total_mismatch_lines", {
      lines: line_items.map((li) => ({
        qty: li.quantity,
        unit_amount_cents: li.price_data.unit_amount,
        name: li.price_data.product_data.name.slice(0, 60),
      })),
    })
    console.error("[checkout/order] total mismatch", {
      sumCents,
      sumPesos: sumCents / 100,
      expectedTotalPesos: expectedTotal,
      expectedCents: Math.round(expectedTotal * 100),
      numero: row.numero,
      orderIdPrefix: orderId.slice(0, 8),
    })
    return NextResponse.json(
      { error: "El total del pedido no coincide. Actualiza la página e intenta de nuevo." },
      { status: 409 },
    )
  }

  const successUrl = staffPos
    ? `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&from=staff`
    : `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = staffPos
    ? `${origin}/staff`
    : `${origin}/orden/${row.numero}`

  checkoutOrderVerbose("stripe_line_items", {
    line_items: line_items.map((li) => ({
      quantity: li.quantity,
      unit_amount: li.price_data.unit_amount,
      currency: li.price_data.currency,
      name: li.price_data.product_data.name.slice(0, 80),
    })),
    sumCents,
    sumPesosFromLines: sumCents / 100,
    dbTotalPesos: expectedTotal,
  })

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: successUrl,
      cancel_url: cancelUrl,
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

    checkoutOrderSummary({
      phase: "stripe_session_created",
      orderIdPrefix: orderId.slice(0, 8),
      numero: row.numero,
      stripeSessionId: session.id,
      /** Stripe: smallest currency unit (MXN centavos). 4500 = 45.00 MXN */
      stripeAmountTotalCents: session.amount_total,
      stripeAmountTotalPesos:
        session.amount_total != null ? session.amount_total / 100 : null,
      currency: session.currency,
      livemode: session.livemode,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error("[checkout/order] stripe_error", {
      orderIdPrefix: orderId.slice(0, 8),
      numero: row.numero,
      sumCents,
      message: e instanceof Error ? e.message : String(e),
    })
    console.error("[checkout/order]", e)
    return NextResponse.json(
      { error: "Error al iniciar el pago. Intenta de nuevo." },
      { status: 500 },
    )
  }
}
