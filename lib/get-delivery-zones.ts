import { createServerSupabase } from "@/lib/supabase/server"
import {
  DELIVERY_ZONES_KEY,
  defaultDeliveryZonesJson,
  parseDeliveryZonesJson,
  type DeliveryZonesJson,
} from "@/lib/delivery-zones"

export async function getDeliveryZones(): Promise<DeliveryZonesJson> {
  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", DELIVERY_ZONES_KEY)
      .maybeSingle()

    if (error || !data?.setting_value) {
      return defaultDeliveryZonesJson()
    }
    return parseDeliveryZonesJson(data.setting_value)
  } catch {
    return defaultDeliveryZonesJson()
  }
}
