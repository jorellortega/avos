export const SUPPLIER_TYPE_OPTIONS = [
  "Carnes",
  "Mariscos",
  "Verduras",
  "Lácteos",
  "Bebidas",
  "Desechables",
  "Especias",
  "Limpieza",
  "Otros",
] as const

export type SupplierType = (typeof SUPPLIER_TYPE_OPTIONS)[number]

export interface SupplierRow {
  id: string
  name: string
  phone: string
  supplier_type: string
  price_notes: string
  email: string
  contact_name: string
  notes: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export function normalizeSupplier(row: SupplierRow): SupplierRow {
  return {
    ...row,
    name: row.name.trim(),
    phone: row.phone.trim(),
    supplier_type: row.supplier_type.trim(),
    price_notes: row.price_notes.trim(),
    email: row.email.trim(),
    contact_name: row.contact_name.trim(),
    notes: row.notes.trim(),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order) || 0,
  }
}

export function supplierTypeLabel(raw: string): string {
  const t = raw.trim()
  return t || "Otros"
}

export function emptySupplier(): Omit<
  SupplierRow,
  "id" | "created_at" | "updated_at"
> {
  return {
    name: "",
    phone: "",
    supplier_type: "Otros",
    price_notes: "",
    email: "",
    contact_name: "",
    notes: "",
    is_active: true,
    sort_order: 0,
  }
}
