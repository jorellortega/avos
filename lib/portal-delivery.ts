import type { Order, OrderType } from "@/components/orders-provider"

/** Default envío when staff selects domicilio (editable per order). */
export const PORTAL_DEFAULT_DELIVERY_FEE = 15

export type PortalDeliveryInfo = {
  deliveryZoneId?: string
  deliveryZoneLabel?: string
  deliveryFee?: number
  deliveryAddress?: string
}

export function portalOrderNeedsDeliveryInfo(
  tipo: OrderType,
  delivery: PortalDeliveryInfo,
): boolean {
  if (tipo !== "domicilio") return false
  return !delivery.deliveryZoneId?.trim() || !delivery.deliveryAddress?.trim()
}

export function parsePortalDeliveryFeeInput(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, ".")
  if (!cleaned) return 0
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

/** Apply default domicilio fee when none set yet. */
export function portalDeliveryForTipo(
  tipo: OrderType,
  delivery: PortalDeliveryInfo,
): PortalDeliveryInfo {
  if (tipo !== "domicilio") {
    return {
      deliveryZoneId: undefined,
      deliveryZoneLabel: undefined,
      deliveryFee: undefined,
      deliveryAddress: undefined,
    }
  }
  const fee =
    delivery.deliveryFee != null && delivery.deliveryFee >= 0
      ? delivery.deliveryFee
      : PORTAL_DEFAULT_DELIVERY_FEE
  return { ...delivery, deliveryFee: fee }
}

export function portalDeliveryFromOrder(
  order: Pick<
    Order,
    | "deliveryZoneId"
    | "deliveryZoneLabel"
    | "deliveryFee"
    | "deliveryAddress"
  >,
): PortalDeliveryInfo {
  return {
    deliveryZoneId: order.deliveryZoneId,
    deliveryZoneLabel: order.deliveryZoneLabel,
    deliveryFee: order.deliveryFee,
    deliveryAddress: order.deliveryAddress,
  }
}

export function portalOrderTotal(
  itemsSubtotal: number,
  tipo: OrderType,
  delivery: PortalDeliveryInfo,
  extraCharge = 0,
  discountAmount = 0,
): number {
  const fee = tipo === "domicilio" ? Math.max(0, delivery.deliveryFee ?? 0) : 0
  const extra = Math.max(0, extraCharge ?? 0)
  const discount = Math.max(0, discountAmount ?? 0)
  const raw = itemsSubtotal + fee + extra - discount
  return Math.round(Math.max(0, raw) * 100) / 100
}

/** @deprecated Use portalOrderTotal — kept for existing call sites. */
export function portalItemsTotalWithDelivery(
  itemsSubtotal: number,
  tipo: OrderType,
  delivery: PortalDeliveryInfo,
  extraCharge = 0,
  discountAmount = 0,
): number {
  return portalOrderTotal(
    itemsSubtotal,
    tipo,
    delivery,
    extraCharge,
    discountAmount,
  )
}
