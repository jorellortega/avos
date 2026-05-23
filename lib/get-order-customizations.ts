import { createServerSupabase } from "@/lib/supabase/server"
import {
  ORDER_CUSTOMIZATIONS_KEY,
  buildOrderCustomizationsHelpers,
  defaultOrderCustomizationsJson,
  parseOrderCustomizationsJson,
  type OrderCustomizationsHelpers,
} from "@/lib/order-item-customizations"

export type { OrderCustomizationsHelpers } from "@/lib/order-item-customizations"

export async function getOrderCustomizations(): Promise<OrderCustomizationsHelpers> {
  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", ORDER_CUSTOMIZATIONS_KEY)
      .maybeSingle()

    if (error || !data?.setting_value) {
      return buildOrderCustomizationsHelpers(defaultOrderCustomizationsJson())
    }
    const json = parseOrderCustomizationsJson(data.setting_value)
    return buildOrderCustomizationsHelpers(json)
  } catch {
    return buildOrderCustomizationsHelpers(defaultOrderCustomizationsJson())
  }
}
