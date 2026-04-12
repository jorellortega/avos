"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  imagenProteinaPorId,
  proteinas,
  type Proteina,
} from "@/lib/menu-data"
import { SITE_MEDIA_KEYS } from "@/lib/site-media-shared"

/**
 * Loads merged protein thumbnail URLs from public `ai_settings` (same as `/menu` / `getSiteMedia`).
 */
export function useProteinaImagenes() {
  const [map, setMap] = useState<Record<Proteina, string>>(() => ({
    ...imagenProteinaPorId,
  }))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const client = createBrowserSupabase()
        const { data } = await client
          .from("ai_settings")
          .select("setting_value")
          .eq("setting_key", SITE_MEDIA_KEYS.proteinaImagenes)
          .maybeSingle()
        if (cancelled || !data?.setting_value?.trim()) return
        const parsed = JSON.parse(data.setting_value) as Record<string, string>
        setMap((prev) => {
          const next = { ...prev }
          for (const p of proteinas) {
            const u = parsed[p]?.trim()
            if (u) next[p] = u
          }
          return next
        })
      } catch {
        /* keep defaults */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return map
}
