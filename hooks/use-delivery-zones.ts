"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  DELIVERY_ZONES_KEY,
  defaultDeliveryZonesJson,
  parseDeliveryZonesJson,
  type DeliveryZonesJson,
} from "@/lib/delivery-zones"

export function useDeliveryZones(): {
  zones: DeliveryZonesJson
  loading: boolean
  refresh: () => Promise<void>
} {
  const [zones, setZones] = useState<DeliveryZonesJson>(defaultDeliveryZonesJson)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const supabase = createBrowserSupabase()
    const { data, error } = await supabase
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", DELIVERY_ZONES_KEY)
      .maybeSingle()

    if (error || !data?.setting_value) {
      setZones(defaultDeliveryZonesJson())
    } else {
      setZones(parseDeliveryZonesJson(data.setting_value))
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  return { zones, loading, refresh: load }
}
