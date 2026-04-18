import { NextResponse } from "next/server"
import { getStripe, isStripeConfigured } from "@/lib/stripe"

export const runtime = "nodejs"

/** Public: returns order # from Checkout metadata after payment (for success page links). */
export async function GET(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 })
  }

  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const raw = session.metadata?.avos_order_numero
    const n = raw != null && raw !== "" ? parseInt(String(raw), 10) : NaN
    return NextResponse.json({
      numero: Number.isFinite(n) ? n : null,
      flow: session.metadata?.avos_flow ?? null,
    })
  } catch (e) {
    console.error("[session-summary]", e)
    return NextResponse.json({ error: "could not load session" }, { status: 400 })
  }
}
