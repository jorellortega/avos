import type { Order, OrderType } from "@/components/orders-provider"

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
): number {
  const fee = tipo === "domicilio" ? Math.max(0, delivery.deliveryFee ?? 0) : 0
  const extra = Math.max(0, extraCharge ?? 0)
  return Math.round((itemsSubtotal + fee + extra) * 100) / 100
}

/** @deprecated Use portalOrderTotal — kept for existing call sites. */
export function portalItemsTotalWithDelivery(
  itemsSubtotal: number,
  tipo: OrderType,
  delivery: PortalDeliveryInfo,
  extraCharge = 0,
): number {
  return portalOrderTotal(itemsSubtotal, tipo, delivery, extraCharge)
}
