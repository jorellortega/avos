import { NextResponse } from "next/server"
import { getStripe, isStripeConfigured } from "@/lib/stripe"

export const runtime = "nodejs"

/**
 * Sandbox-only: creates a small test Checkout Session (10 MXN).
 * Refuses to run unless STRIPE_SECRET_KEY starts with sk_test_.
 */
export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key?.startsWith("sk_test_")) {
    return NextResponse.json(
      {
        error:
          "Esta ruta solo funciona con claves de prueba (sk_test_). No uses claves live aquí.",
      },
      { status: 403 },
    )
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Añade STRIPE_SECRET_KEY en .env.local." },
      { status: 503 },
    )
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"

  const stripe = getStripe()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            product_data: {
              name: "Prueba Sandbox — Avos",
              description: "Cargo de prueba para practicar Stripe (10.00 MXN)",
            },
            unit_amount: 1000,
          },
        },
      ],
      success_url: `${origin}/test-stripe?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/test-stripe?status=canceled`,
      metadata: { avos_test: "true" },
      locale: "es",
    })

    if (!session.url) {
      return NextResponse.json({ error: "Sin URL de sesión" }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error("[test-stripe]", e)
    return NextResponse.json({ error: "Error al crear la sesión de prueba" }, { status: 500 })
  }
}
