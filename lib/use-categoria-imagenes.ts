"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { BEBIDAS_CATEGORIA_ID, categorias } from "@/lib/menu-data"
import { SITE_MEDIA_KEYS, defaultSiteMedia } from "@/lib/site-media-shared"

/**
 * Loads merged category thumbnail URLs from public `ai_settings` (same as `/` and `/menu`).
 */
export function useCategoriaImagenes() {
  const [map, setMap] = useState<Record<string, string>>(() => ({
    ...defaultSiteMedia().categoriaImagenes,
  }))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const client = createBrowserSupabase()
        const { data } = await client
          .from("ai_settings")
          .select("setting_value")
          .eq("setting_key", SITE_MEDIA_KEYS.categoriaImagenes)
          .maybeSingle()
        if (cancelled || !data?.setting_value?.trim()) return
        const parsed = JSON.parse(data.setting_value) as Record<string, string>
        setMap((prev) => {
          const next = { ...prev }
          for (const c of categorias) {
            const u = parsed[c.id]?.trim()
            if (u) next[c.id] = u
          }
          const beb = parsed[BEBIDAS_CATEGORIA_ID]?.trim()
          if (beb) next[BEBIDAS_CATEGORIA_ID] = beb
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
