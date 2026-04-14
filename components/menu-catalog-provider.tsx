"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useMenuCatalog } from "@/hooks/use-menu-catalog"
import type { MenuCatalogHelpers } from "@/lib/menu-catalog-shared"

type MenuCatalogContextValue = {
  catalog: MenuCatalogHelpers | null
  loading: boolean
  refresh: () => Promise<void>
}

const MenuCatalogContext = createContext<MenuCatalogContextValue | null>(null)

export function MenuCatalogProvider({ children }: { children: ReactNode }) {
  const { catalog, loading, refresh } = useMenuCatalog()
  return (
    <MenuCatalogContext.Provider value={{ catalog, loading, refresh }}>
      {children}
    </MenuCatalogContext.Provider>
  )
}

export function useMenuCatalogContext(): MenuCatalogContextValue {
  const ctx = useContext(MenuCatalogContext)
  if (!ctx) {
    throw new Error("useMenuCatalogContext requires MenuCatalogProvider")
  }
  return ctx
}

/** Optional: returns null if outside provider (for isolated stories/tests). */
export function useMenuCatalogContextOptional(): MenuCatalogContextValue | null {
  return useContext(MenuCatalogContext)
}
