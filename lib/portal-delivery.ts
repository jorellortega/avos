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

export function portalItemsTotalWithDelivery(
  itemsSubtotal: number,
  tipo: OrderType,
  delivery: PortalDeliveryInfo,
): number {
  if (tipo !== "domicilio") return itemsSubtotal
  const fee = delivery.deliveryFee ?? 0
  return itemsSubtotal + fee
}
