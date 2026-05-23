"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useOrderCustomizations } from "@/hooks/use-order-customizations"
import {
  defaultPlatilloCustomizationConfig,
  type OrderCustomizationsHelpers,
  type PlatilloCustomizationConfig,
} from "@/lib/order-item-customizations"

type OrderCustomizationsContextValue = {
  customizations: OrderCustomizationsHelpers | null
  loading: boolean
  refresh: () => Promise<void>
}

const OrderCustomizationsContext =
  createContext<OrderCustomizationsContextValue | null>(null)

export function OrderCustomizationsProvider({ children }: { children: ReactNode }) {
  const { customizations, loading, refresh } = useOrderCustomizations()
  return (
    <OrderCustomizationsContext.Provider
      value={{ customizations, loading, refresh }}
    >
      {children}
    </OrderCustomizationsContext.Provider>
  )
}

export function useOrderCustomizationsContext(): OrderCustomizationsContextValue {
  const ctx = useContext(OrderCustomizationsContext)
  if (!ctx) {
    throw new Error(
      "useOrderCustomizationsContext requires OrderCustomizationsProvider",
    )
  }
  return ctx
}

export function useOrderCustomizationsContextOptional(): OrderCustomizationsContextValue | null {
  return useContext(OrderCustomizationsContext)
}

export function useCustomizationConfig(
  categoriaId: string,
  platilloId?: string,
): PlatilloCustomizationConfig {
  const { customizations } = useOrderCustomizationsContext()
  return (
    customizations?.getConfig(categoriaId, platilloId) ??
    defaultPlatilloCustomizationConfig()
  )
}
