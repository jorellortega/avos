"use client"

import type { Order, OrderItem, OrderStatus } from "@/components/orders-provider"
import { logCheckoutClient } from "@/lib/checkout-debug-client"
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

/**
 * Syncs cart lines + total to Supabase for a pending order (e.g. after "Modificar pedido"
 * or right before online pay) so /api/checkout/order charges the same amounts as the UI.
 * Requires migration `20260202120000_customer_update_avos_order_cart.sql` on Supabase.
 */
export async function updateAvosOrderCartInSupabase(
  orderId: string,
  items: OrderItem[],
  total: number,
): Promise<boolean> {
  logCheckoutClient("updateAvosOrderCartInSupabase:before", {
    orderIdPrefix: orderId.slice(0, 8),
    total,
    lineCount: items.length,
    lines: items.map((i) => ({
      nombre: i.nombre?.slice(0, 60),
      cantidad: i.cantidad,
      precio: i.precio,
      sub: (i.precio ?? 0) * (i.cantidad ?? 0),
    })),
  })
  try {
    const supabase = createBrowserSupabase()
    const { error } = await supabase.rpc("customer_update_avos_order_cart", {
      p_id: orderId,
      p_items: items,
      p_total: total,
    })
    if (error) {
      console.error("updateAvosOrderCartInSupabase", error.message, error)
      logCheckoutClient("updateAvosOrderCartInSupabase:error", {
        message: error.message,
        code: error.code,
      })
      return false
    }
    logCheckoutClient("updateAvosOrderCartInSupabase:ok", { orderIdPrefix: orderId.slice(0, 8), total })
    return true
  } catch (e) {
    console.error("updateAvosOrderCartInSupabase", e)
    logCheckoutClient("updateAvosOrderCartInSupabase:exception", {
      message: e instanceof Error ? e.message : String(e),
    })
    return false
  }
}

const PORTAL_ORDER_FETCH_MS = 20_000

async function portalOrderFetch(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PORTAL_ORDER_FETCH_MS)
  try {
    const res = await fetch("/api/portal/submit-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? `Error ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "Tiempo de espera agotado. Revisa tu conexión."
        : e instanceof Error
          ? e.message
          : "Error de red"
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

/** Portal POS: same-origin API avoids browser → Supabase CORS/network quirks. */
export async function insertAvosOrderForPortal(
  order: Order,
): Promise<{ ok: boolean; error?: string }> {
  return portalOrderFetch({ order })
}

export async function portalUpdateOrderTipo(
  orderId: string,
  tipo: OrderType,
): Promise<{ ok: boolean; tipo?: OrderType; error?: string }> {
  try {
    const res = await fetch("/api/portal/update-order-tipo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ orderId, tipo }),
    })
    const data = (await res.json()) as {
      ok?: boolean
      tipo?: OrderType
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: data.error ?? `Error ${res.status}` }
    }
    return { ok: true, tipo: (data.tipo as OrderType) ?? tipo }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error de red",
    }
  }
}

export async function portalUpdateOrderDelivery(
  orderId: string,
  delivery: {
    deliveryZoneId: string
    deliveryZoneLabel: string
    deliveryFee: number
    deliveryAddress: string
    total?: number
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/portal/update-order-delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ orderId, ...delivery }),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? `Error ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error de red",
    }
  }
}

export async function portalUpdateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ ok: boolean; status?: OrderStatus; error?: string }> {
  try {
    const res = await fetch("/api/portal/update-order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ orderId, status }),
    })
    const data = (await res.json()) as {
      ok?: boolean
      status?: OrderStatus
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: data.error ?? `Error ${res.status}` }
    }
    return { ok: true, status: data.status ?? status }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error de red",
    }
  }
}

export async function updateAvosOrderCartForPortal(
  orderId: string,
  items: OrderItem[],
  total: number,
  extraCharge = 0,
  discountAmount = 0,
  discountPreset?: string | null,
  discountPercent?: number | null,
): Promise<{ ok: boolean; error?: string }> {
  return portalOrderFetch({
    action: "update_cart",
    orderId,
    items,
    total,
    extraCharge,
    discountAmount,
    discountPreset: discountPreset ?? null,
    discountPercent: discountPercent ?? null,
  })
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

    const payload: typeof basePayload & {
      p_customer_user_id?: string
      p_delivery_zone_id?: string | null
      p_delivery_fee?: number | null
      p_delivery_address?: string | null
      p_delivery_photo_street_url?: string | null
      p_delivery_photo_house_url?: string | null
    } = {
      ...basePayload,
      p_delivery_zone_id: order.deliveryZoneId ?? null,
      p_delivery_fee: order.deliveryFee ?? null,
      p_delivery_address: order.deliveryAddress ?? null,
      p_delivery_photo_street_url: order.deliveryPhotoStreetUrl ?? null,
      p_delivery_photo_house_url: order.deliveryPhotoHouseUrl ?? null,
      p_extra_charge: order.extraCharge ?? 0,
      p_discount_amount: order.discountAmount ?? 0,
      p_discount_preset: order.discountPreset ?? null,
      p_discount_percent: order.discountPercent ?? null,
      ...(customerUserId ? { p_customer_user_id: customerUserId } : {}),
    }

    let { error } = await supabase.rpc("insert_avos_order", payload)

    if (error && customerUserId && isMissingInsertAvosOrderOverload(error)) {
      console.warn(
        "[insertAvosOrderToSupabase] DB has old insert_avos_order (8 args). Retrying without customer_user_id. Apply migration 20250413900000_avos_orders_customer_user.sql on Supabase.",
      )
      ;({ error } = await supabase.rpc("insert_avos_order", basePayload))
    }

    if (error) {
      if (error.message?.toLowerCase().includes("ordering_disabled")) {
        return false
      }
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
