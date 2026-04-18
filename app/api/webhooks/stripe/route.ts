import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { fulfillAvosOrderFromStripeSession } from "@/lib/stripe-order-fulfillment"
import { getStripe } from "@/lib/stripe"

export const runtime = "nodejs"

/**
 * Stripe webhooks — verify with STRIPE_WEBHOOK_SECRET (and optionally
 * STRIPE_WEBHOOK_SECRET_THIN) when Dashboard sends snapshot + thin to the same URL.
 *
 * Local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
 */
export async function POST(request: Request) {
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_THIN,
  ].filter((s): s is string => Boolean(s?.trim()))

  if (secrets.length === 0) {
    console.error("[stripe webhook] Set STRIPE_WEBHOOK_SECRET in env")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  const body = await request.text()

  const stripe = getStripe()
  let event: Stripe.Event | null = null
  let lastErr: unknown
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret)
      break
    } catch (e) {
      lastErr = e
    }
  }

  if (!event) {
    console.error("[stripe webhook] Signature verification failed:", lastErr)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      console.log("[stripe webhook] checkout.session.completed", session.id, session.amount_total)
      try {
        await fulfillAvosOrderFromStripeSession(session, stripe)
      } catch (e) {
        console.error("[stripe webhook] fulfillment", e)
        return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 })
      }
      break
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent
      console.log("[stripe webhook] payment_intent.succeeded", pi.id)
      break
    }
    default:
      console.log("[stripe webhook]", event.type)
  }

  return NextResponse.json({ received: true })
}
