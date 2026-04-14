import { NextResponse } from "next/server"
import { getStripe, isStripeConfigured } from "@/lib/stripe"

export const runtime = "nodejs"

type CheckoutItem = {
  nombre: string
  precio: number
  cantidad: number
}

type CheckoutBody = {
  items: CheckoutItem[]
  customerEmail: string
  nombre: string
  telefono: string
  horaRecogida: string
  notasEspeciales?: string
  /** Menú en línea: para llevar o comer en mesa */
  orderType?: "takeout" | "dine-in"
  mesa?: string
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

  let body: CheckoutBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const { items, customerEmail, nombre, telefono, horaRecogida, notasEspeciales, orderType, mesa } =
    body

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 })
  }
  if (!customerEmail?.trim() || !nombre?.trim() || !telefono?.trim() || !horaRecogida) {
    return NextResponse.json({ error: "Faltan datos de contacto" }, { status: 400 })
  }
  if (!orderType || (orderType !== "takeout" && orderType !== "dine-in")) {
    return NextResponse.json(
      { error: "Indica si el pedido es para llevar o para aquí." },
      { status: 400 },
    )
  }
  if (orderType === "dine-in" && !mesa?.trim()) {
    return NextResponse.json({ error: "Indica el número de mesa." }, { status: 400 })
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"

  const stripe = getStripe()

  const line_items = []
  for (const item of items) {
    const unit_amount = Math.round(item.precio * 100)
    if (!Number.isFinite(unit_amount) || unit_amount < 1) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 })
    }
    line_items.push({
      quantity: Math.max(1, Math.floor(item.cantidad)),
      price_data: {
        currency: "mxn" as const,
        product_data: {
          name: item.nombre.slice(0, 120),
        },
        unit_amount,
      },
    })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      customer_email: customerEmail.trim(),
      metadata: {
        nombre: nombre.trim().slice(0, 500),
        telefono: telefono.trim().slice(0, 50),
        horaRecogida: horaRecogida.slice(0, 100),
        notas: (notasEspeciales ?? "").slice(0, 500),
        orderType: orderType.slice(0, 20),
        mesa: orderType === "dine-in" ? (mesa ?? "").trim().slice(0, 20) : "",
      },
      locale: "es",
    })

    if (!session.url) {
      return NextResponse.json({ error: "No se pudo crear la sesión de pago" }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error("[checkout]", e)
    return NextResponse.json(
      { error: "Error al iniciar el pago. Intenta de nuevo." },
      { status: 500 },
    )
  }
}
