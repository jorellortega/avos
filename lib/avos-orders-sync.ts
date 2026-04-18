"use client"

import type { Order } from "@/components/orders-provider"
import { createBrowserSupabase } from "@/lib/supabase/client"

/**
 * Persists a new order to Supabase (for staff reporting). Safe to ignore failures (local order still works).
 */
function isMissingInsertAvosOrderOverload(err: { message?: string; code?: string }): boolean {
  const m = err.message ?? ""
  return (
    m.includes("Could not find the function") && m.includes("insert_avos_order")
  )
}

export async function insertAvosOrderToSupabase(order: Order): Promise<boolean> {
  try {
    const supabase = createBrowserSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const customerUserId = session?.user?.id ?? null

    const basePayload = {
      p_id: order.id,
      p_numero: order.numero,
      p_total: order.total,
      p_status: order.status,
      p_order_type: order.tipo,
      p_mesa: order.mesa ?? null,
      p_nombre_cliente: order.nombreCliente ?? null,
      p_items: order.items,
    }

    let payload: typeof basePayload & { p_customer_user_id?: string } = basePayload
    if (customerUserId) {
      payload = { ...basePayload, p_customer_user_id: customerUserId }
    }

    let { error } = await supabase.rpc("insert_avos_order", payload)

    if (error && customerUserId && isMissingInsertAvosOrderOverload(error)) {
      console.warn(
        "[insertAvosOrderToSupabase] DB has old insert_avos_order (8 args). Retrying without customer_user_id. Apply migration 20250413900000_avos_orders_customer_user.sql on Supabase.",
      )
      ;({ error } = await supabase.rpc("insert_avos_order", basePayload))
    }

    if (error) {
      console.error("insertAvosOrderToSupabase", error.message)
      return false
    }
    return true
  } catch (e) {
    console.error("insertAvosOrderToSupabase", e)
    return false
  }
}

/**
 * Mesa: customer taps "pagar en caja" once — records `caja`; staff picks efectivo/tarjeta.
 * Pickup: legacy `tarjeta` intent only if ever used; normal flow is Stripe.
 * Does not mark the order as paid in the database.
 */
export async function recordCustomerPaymentIntentToSupabase(
  orderId: string,
  method: "efectivo" | "tarjeta" | "caja",
): Promise<boolean> {
  try {
    const supabase = createBrowserSupabase()
    const { error } = await supabase.rpc("record_customer_payment_intent", {
      p_id: orderId,
      p_payment_method: method,
    })
    if (error) {
      console.error("recordCustomerPaymentIntentToSupabase", error.message)
      return false
    }
    return true
  } catch (e) {
    console.error("recordCustomerPaymentIntentToSupabase", e)
    return false
  }
}

/**
 * Staff confirms payment at the register (authenticated RPC).
 */
export async function staffConfirmAvosOrderPayment(
  orderId: string,
  method: "efectivo" | "tarjeta",
): Promise<boolean> {
  try {
    const supabase = createBrowserSupabase()
    const { error } = await supabase.rpc("staff_confirm_avos_order_payment", {
      p_id: orderId,
      p_payment_method: method,
    })
    if (error) {
      console.error("staffConfirmAvosOrderPayment", error.message)
      return false
    }
    return true
  } catch (e) {
    console.error("staffConfirmAvosOrderPayment", e)
    return false
  }
}
