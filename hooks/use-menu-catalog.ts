"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  MENU_CATALOG_KEY,
  buildMenuCatalogHelpers,
  defaultMenuCatalogJson,
  parseMenuCatalogJson,
  type MenuCatalogHelpers,
} from "@/lib/menu-catalog-shared"

export function useMenuCatalog(): {
  catalog: MenuCatalogHelpers | null
  loading: boolean
  refresh: () => Promise<void>
} {
  const [catalog, setCatalog] = useState<MenuCatalogHelpers | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const supabase = createBrowserSupabase()
    const { data, error } = await supabase
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", MENU_CATALOG_KEY)
      .maybeSingle()

    if (error || !data?.setting_value) {
      setCatalog(buildMenuCatalogHelpers(defaultMenuCatalogJson()))
    } else {
      setCatalog(buildMenuCatalogHelpers(parseMenuCatalogJson(data.setting_value)))
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  return { catalog, loading, refresh: load }
}
