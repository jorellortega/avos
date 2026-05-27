"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react"
import { Proteina } from "@/lib/menu-data"

export type OrderStatus = "pendiente" | "preparando" | "listo" | "entregado" | "pagado"
export type OrderType = "mesa" | "pickup" | "domicilio"

export interface OrderItem {
  id: string
  categoria: string
  nombre: string
  proteina?: Proteina
  cantidad: number
  precio: number
  notas?: string
  /** Platillo needs protein but none was chosen yet (portal). */
  needsProteina?: boolean
  /** Drink needs chico/grande but size was not specified (portal). */
  needsBebidaTamano?: boolean
  /** Drink flavor not specified (e.g. "large drink") (portal). */
  needsBebidaEleccion?: boolean
  bebidaId?: string
}

export interface Order {
  id: string
  numero: number
  nombreCliente?: string
  mesa?: string
  tipo: OrderType
  items: OrderItem[]
  status: OrderStatus
  total: number
  createdAt: Date
  updatedAt: Date
  deliveryZoneId?: string
  deliveryZoneLabel?: string
  deliveryFee?: number
  deliveryAddress?: string
  deliveryPhotoStreetUrl?: string
  deliveryPhotoHouseUrl?: string
}

interface OrdersContextType {
  orders: Order[]
  addOrder: (order: Omit<Order, "id" | "numero" | "createdAt" | "updatedAt">) => Order
  updateOrderStatus: (orderId: string, status: OrderStatus) => void
  updateOrder: (orderId: string, updates: Partial<Order>) => void
  getOrderByNumber: (numero: number) => Order | undefined
  getNextOrderNumber: () => number
  deleteOrder: (orderId: string) => void
  /** Merge server rows (e.g. today's orders) without wiping local edits. */
  mergeServerOrders: (incoming: Order[]) => void
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [orderCounter, setOrderCounter] = useState(1)
  const [hydrated, setHydrated] = useState(false)

  // Load orders from localStorage on mount
  useEffect(() => {
    const savedOrders = localStorage.getItem("avos-orders")
    const savedCounter = localStorage.getItem("avos-order-counter")
    if (savedOrders) {
      try {
        const parsed = JSON.parse(savedOrders) as Order[]
        if (Array.isArray(parsed)) {
          setOrders(
            parsed.map((o) => ({
              ...o,
              createdAt: new Date(o.createdAt),
              updatedAt: new Date(o.updatedAt),
            })),
          )
        }
      } catch {
        localStorage.removeItem("avos-orders")
      }
    }
    if (savedCounter) {
      setOrderCounter(parseInt(savedCounter, 10))
    }
    setHydrated(true)
  }, [])

  // Persist every change (including empty list after delete)
  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem("avos-orders", JSON.stringify(orders))
  }, [orders, hydrated])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem("avos-order-counter", orderCounter.toString())
  }, [orderCounter, hydrated])

  const getNextOrderNumber = () => orderCounter

  const addOrder = (orderData: Omit<Order, "id" | "numero" | "createdAt" | "updatedAt">): Order => {
    const newOrder: Order = {
      ...orderData,
      id: crypto.randomUUID(),
      numero: orderCounter,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    setOrders(prev => [...prev, newOrder])
    setOrderCounter(prev => prev + 1)
    return newOrder
  }

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status } : order,
      ),
    )
  }, [])

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? { ...order, ...updates, updatedAt: new Date() }
          : order,
      ),
    )
  }, [])

  const getOrderByNumber = (numero: number) => {
    return orders.find(o => o.numero === numero)
  }

  const deleteOrder = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId))
  }

  const mergeServerOrders = useCallback((incoming: Order[]) => {
    if (incoming.length === 0) return
    setOrders((prev) => {
      const byId = new Map(prev.map((o) => [o.id, o]))
      for (const row of incoming) {
        const existing = byId.get(row.id)
        if (!existing) {
          byId.set(row.id, row)
          continue
        }
        if (row.updatedAt.getTime() >= existing.updatedAt.getTime()) {
          byId.set(row.id, row)
        }
      }
      return Array.from(byId.values())
    })
    setOrderCounter((prev) => {
      const maxNum = incoming.reduce((m, o) => Math.max(m, o.numero), 0)
      return Math.max(prev, maxNum + 1)
    })
  }, [])

  return (
    <OrdersContext.Provider value={{
      orders,
      addOrder,
      updateOrderStatus,
      updateOrder,
      getOrderByNumber,
      getNextOrderNumber,
      deleteOrder,
      mergeServerOrders,
    }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider")
  }
  return context
}
