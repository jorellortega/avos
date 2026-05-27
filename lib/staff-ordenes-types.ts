export type StaffOrdenesOrderRow = {
  id: string
  numero: number
  total: number
  status: string
  order_type: string
  mesa: string | null
  nombre_cliente: string | null
  payment_method: string | null
  paid_at: string | null
  created_at: string
  delivery_zone_id: string | null
  delivery_address: string | null
  delivery_photo_street_url: string | null
  delivery_photo_house_url: string | null
}
