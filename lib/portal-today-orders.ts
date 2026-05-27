import type { Order, OrderItem, OrderStatus, OrderType } from "@/components/orders-provider"

export type AvosOrderDbRow = {
  id: string
  numero: number
  total: number
  status: string
  order_type: string
  mesa: string | null
  nombre_cliente: string | null
  items: unknown
  created_at: string
  updated_at: string
  delivery_zone_id?: string | null
  delivery_fee?: number | null
  delivery_address?: string | null
  delivery_photo_street_url?: string | null
  delivery_photo_house_url?: string | null
}

const VALID_STATUS = new Set<OrderStatus>([
  "pendiente",
  "preparando",
  "listo",
  "entregado",
  "pagado",
])

export function startOfTodayUtcRange(): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

export function isOrderCreatedToday(createdAt: Date): boolean {
  const now = new Date()
  return (
    createdAt.getFullYear() === now.getFullYear() &&
    createdAt.getMonth() === now.getMonth() &&
    createdAt.getDate() === now.getDate()
  )
}

export function mapAvosOrderRowToOrder(row: AvosOrderDbRow): Order | null {
  if (!Array.isArray(row.items) || row.items.length === 0) return null
  const status = VALID_STATUS.has(row.status as OrderStatus)
    ? (row.status as OrderStatus)
    : "pendiente"
  const tipo =
    row.order_type === "pickup" || row.order_type === "domicilio"
      ? row.order_type
      : "mesa"

  return {
    id: row.id,
    numero: row.numero,
    nombreCliente: row.nombre_cliente ?? undefined,
    mesa: row.mesa ?? undefined,
    tipo,
    items: row.items as OrderItem[],
    status,
    total: Number(row.total),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deliveryZoneId: row.delivery_zone_id ?? undefined,
    deliveryFee:
      row.delivery_fee != null ? Number(row.delivery_fee) : undefined,
    deliveryAddress: row.delivery_address ?? undefined,
    deliveryPhotoStreetUrl: row.delivery_photo_street_url ?? undefined,
    deliveryPhotoHouseUrl: row.delivery_photo_house_url ?? undefined,
  }
}
