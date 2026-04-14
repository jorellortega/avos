import { createServerSupabase } from "@/lib/supabase/server"
import {
  MENU_CATALOG_KEY,
  buildMenuCatalogHelpers,
  defaultMenuCatalogJson,
  parseMenuCatalogJson,
  type MenuCatalogHelpers,
} from "@/lib/menu-catalog-shared"

export type { MenuCatalogHelpers, MenuCatalogJson } from "@/lib/menu-catalog-shared"

/**
 * Server-side menu prices + availability (merged with defaults from menu-data).
 */
export async function getMenuCatalog(): Promise<MenuCatalogHelpers> {
  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from("ai_settings")
      .select("setting_value")
      .eq("setting_key", MENU_CATALOG_KEY)
      .maybeSingle()

    if (error || !data?.setting_value) {
      return buildMenuCatalogHelpers(defaultMenuCatalogJson())
    }
    const json = parseMenuCatalogJson(data.setting_value)
    return buildMenuCatalogHelpers(json)
  } catch {
    return buildMenuCatalogHelpers(defaultMenuCatalogJson())
  }
}
