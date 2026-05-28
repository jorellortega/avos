"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { SITE_MEDIA_KEYS } from "@/lib/site-media-shared"

/**
 * Per-drink thumbnail URLs from public `ai_settings` (`public_bebida_imagenes`).
 * Only includes drinks with an uploaded URL — no category fallback.
 */
export function useBebidaImagenes() {
  const [map, setMap] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const client = createBrowserSupabase()
        const { data } = await client
          .from("ai_settings")
          .select("setting_value")
          .eq("setting_key", SITE_MEDIA_KEYS.bebidaImagenes)
          .maybeSingle()
        if (cancelled || !data?.setting_value?.trim()) return
        const parsed = JSON.parse(data.setting_value) as Record<string, string>
        const next: Record<string, string> = {}
        for (const [id, url] of Object.entries(parsed)) {
          const u = typeof url === "string" ? url.trim() : ""
          if (id && u) next[id] = u
        }
        setMap(next)
      } catch {
        /* keep empty */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return map
}
