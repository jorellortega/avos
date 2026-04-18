import { NextResponse } from "next/server"
import type { OrderStatusPayload } from "@/lib/checkout-order-status"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getStripe, isStripeConfigured } from "@/lib/stripe"

export const runtime = "nodejs"

/**
 * Order row for success / tracking page (session_id → Stripe metadata → avos_orders).
 */
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
    const orderId = session.metadata?.avos_order_id?.trim() ?? null
    const flow = session.metadata?.avos_flow ?? null

    if (!orderId) {
      const body: OrderStatusPayload = {
        orderId: null,
        numero: null,
        flow,
        status: null,
        paid_at: null,
        total: null,
        payment_method: null,
        order_type: null,
      }
      return NextResponse.json(body)
    }

    const supabase = createServiceRoleClient()
    const { data: row, error } = await supabase
      .from("avos_orders")
      .select("numero,status,total,paid_at,payment_method,order_type")
      .eq("id", orderId)
      .maybeSingle()

    if (error) {
      console.error("[order-status]", error.message)
      return NextResponse.json({ error: "lookup failed" }, { status: 500 })
    }

    const body: OrderStatusPayload = {
      orderId,
      numero: row?.numero ?? null,
      flow,
      status: row?.status ?? null,
      paid_at: row?.paid_at ?? null,
      total: row?.total != null ? Number(row.total) : null,
      payment_method: row?.payment_method ?? null,
      order_type: row?.order_type ?? null,
    }
    return NextResponse.json(body)
  } catch (e) {
    console.error("[order-status]", e)
    return NextResponse.json({ error: "could not load" }, { status: 400 })
  }
}
