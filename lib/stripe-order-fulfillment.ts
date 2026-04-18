import type Stripe from "stripe"
import { createServiceRoleClient } from "@/lib/supabase-server"

/**
 * Marks a pickup or dine-in (mesa) order paid when Stripe Checkout completes (metadata.avos_order_id).
 * Idempotent if paid_at already set. Verifies amount vs stored total.
 * Pass `stripe` so thin webhook payloads can retrieve the full session.
 */
export async function fulfillAvosOrderFromStripeSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
): Promise<void> {
  let s = session
  if (!s.metadata?.avos_order_id?.trim() && s.id) {
    try {
      s = await stripe.checkout.sessions.retrieve(s.id)
    } catch (e) {
      console.error("[stripe fulfillment] retrieve session", e)
      return
    }
  }

  const orderId = s.metadata?.avos_order_id?.trim()
  if (!orderId) return

  if (s.payment_status !== "paid") {
    console.log("[stripe fulfillment] skip session not paid", s.id)
    return
  }

  const supabase = createServiceRoleClient()

  const { data: row, error } = await supabase
    .from("avos_orders")
    .select("id,total,status,order_type,paid_at,numero")
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[stripe fulfillment] select", error.message)
    return
  }
  if (!row) {
    console.error("[stripe fulfillment] order not found", orderId)
    return
  }
  if (row.paid_at) return

  if (row.order_type !== "pickup" && row.order_type !== "mesa") {
    console.warn("[stripe fulfillment] skip unsupported order_type", row.order_type, orderId)
    return
  }
  if (row.status !== "pendiente") {
    console.warn("[stripe fulfillment] skip status", row.status, orderId)
    return
  }

  const expectedCents = Math.round(Number(row.total) * 100)
  const got = s.amount_total
  if (got != null && got !== expectedCents) {
    console.error("[stripe fulfillment] amount mismatch", {
      orderId,
      expectedCents,
      got,
      sessionId: s.id,
    })
    return
  }

  const { error: upErr } = await supabase
    .from("avos_orders")
    .update({
      payment_method: "tarjeta",
      paid_at: new Date().toISOString(),
      status: "pagado",
    })
    .eq("id", orderId)
    .is("paid_at", null)

  if (upErr) {
    console.error("[stripe fulfillment] update", upErr.message)
    return
  }

  console.log("[stripe fulfillment] order marked pagado", orderId, "numero", row.numero)
}
