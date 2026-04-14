"use client"

import type { Order } from "@/components/orders-provider"
import { createBrowserSupabase } from "@/lib/supabase/client"

/**
 * Persists a new order to Supabase (for staff reporting). Safe to ignore failures (local order still works).
 */
export async function insertAvosOrderToSupabase(order: Order): Promise<boolean> {
  try {
    const supabase = createBrowserSupabase()
    const { error } = await supabase.rpc("insert_avos_order", {
      p_id: order.id,
      p_numero: order.numero,
      p_total: order.total,
      p_status: order.status,
      p_order_type: order.tipo,
      p_mesa: order.mesa ?? null,
      p_nombre_cliente: order.nombreCliente ?? null,
      p_items: order.items,
    })
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
 * Customer chooses efectivo/tarjeta — caja must confirm later via staff.
 * Does not mark the order as paid in the database.
 */
export async function recordCustomerPaymentIntentToSupabase(
  orderId: string,
  method: "efectivo" | "tarjeta",
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
