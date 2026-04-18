import { NextResponse } from "next/server"
import { fulfillAvosOrderFromStripeSession } from "@/lib/stripe-order-fulfillment"
import { getStripe, isStripeConfigured } from "@/lib/stripe"

export const runtime = "nodejs"

/**
 * After Checkout redirect, client can call this so the order updates even when
 * Stripe webhooks cannot reach localhost (no stripe listen / tunnel).
 * Idempotent with the webhook.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 })
  }

  let body: { session_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const sessionId = body.session_id?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "not paid" }, { status: 400 })
    }
    await fulfillAvosOrderFromStripeSession(session, stripe)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[sync-order-payment]", e)
    return NextResponse.json({ error: "sync failed" }, { status: 500 })
  }
}
