"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  ORDER_CUSTOMIZATIONS_KEY,
  buildOrderCustomizationsHelpers,
  defaultOrderCustomizationsJson,
  parseOrderCustomizationsJson,
  type OrderCustomizationsHelpers,
} from "@/lib/order-item-customizations"

export function useOrderCustomizations(): {
  customizations: OrderCustomizationsHelpers | null
  loading: boolean
  refresh: () => Promise<void>
} {
  const [customizations, setCustomizations] =
    useState<OrderCustomizationsHelpers | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const supabase = createBrowserSupabase()
    const { data, error } = await supabase
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", ORDER_CUSTOMIZATIONS_KEY)
      .maybeSingle()

    if (error || !data?.setting_value) {
      setCustomizations(
        buildOrderCustomizationsHelpers(defaultOrderCustomizationsJson()),
      )
    } else {
      setCustomizations(
        buildOrderCustomizationsHelpers(
          parseOrderCustomizationsJson(data.setting_value),
        ),
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  return { customizations, loading, refresh: load }
}
