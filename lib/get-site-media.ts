import { createServerSupabase } from "@/lib/supabase/server"
import { homeHeroSlides, type HeroSlide } from "@/lib/home-hero-slides"
import type { Proteina } from "@/lib/menu-data"
import {
  SITE_MEDIA_KEYS,
  defaultSiteMedia,
  type SiteMedia,
} from "@/lib/site-media-shared"

export { SITE_MEDIA_KEYS, defaultSiteMedia, type SiteMedia }

function parseHeroSlides(raw: string | null | undefined): HeroSlide[] {
  if (!raw?.trim()) return [...homeHeroSlides]
  try {
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j) || j.length === 0) return [...homeHeroSlides]
    const out: HeroSlide[] = []
    for (let i = 0; i < j.length; i++) {
      const item = j[i] as Record<string, unknown>
      if (
        item &&
        typeof item.src === "string" &&
        typeof item.alt === "string"
      ) {
        out.push({
          id: typeof item.id === "string" ? item.id : `slide-${i + 1}`,
          src: item.src,
          alt: item.alt,
        })
      }
    }
    return out.length > 0 ? out : [...homeHeroSlides]
  } catch {
    return [...homeHeroSlides]
  }
}

function parseCategoriaImagenes(
  raw: string | null | undefined,
): Record<string, string> {
  if (!raw?.trim()) return {}
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== "object" || Array.isArray(j)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(j)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim()
    }
    return out
  } catch {
    return {}
  }
}

function parseProteinaImagenes(
  raw: string | null | undefined,
): Partial<Record<Proteina, string>> {
  if (!raw?.trim()) return {}
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== "object" || Array.isArray(j)) return {}
    const out: Partial<Record<Proteina, string>> = {}
    for (const [k, v] of Object.entries(j)) {
      if (typeof v === "string" && v.trim()) {
        out[k as Proteina] = v.trim()
      }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Loads public site imagery from Supabase (anon-readable rows). Falls back to file defaults.
 */
export async function getSiteMedia(): Promise<SiteMedia> {
  const fallback = defaultSiteMedia()
  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from("ai_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        SITE_MEDIA_KEYS.heroSlides,
        SITE_MEDIA_KEYS.menuBanner,
        SITE_MEDIA_KEYS.categoriaImagenes,
        SITE_MEDIA_KEYS.proteinaImagenes,
      ])

    if (error || !data?.length) {
      return fallback
    }

    const map = Object.fromEntries(
      data.map((r) => [r.setting_key, r.setting_value]),
    ) as Record<string, string | undefined>

    const heroRaw = map[SITE_MEDIA_KEYS.heroSlides]
    const bannerRaw = map[SITE_MEDIA_KEYS.menuBanner]?.trim()
    const catRaw = map[SITE_MEDIA_KEYS.categoriaImagenes]
    const protRaw = map[SITE_MEDIA_KEYS.proteinaImagenes]

    const heroSlides = parseHeroSlides(heroRaw)
    const menuBannerUrl =
      bannerRaw && bannerRaw.length > 0 ? bannerRaw : fallback.menuBannerUrl

    const parsedCats = parseCategoriaImagenes(catRaw)
    const categoriaImagenes = { ...fallback.categoriaImagenes }
    for (const [id, url] of Object.entries(parsedCats)) {
      categoriaImagenes[id] = url
    }

    const parsedProt = parseProteinaImagenes(protRaw)
    const proteinaImagenes = { ...fallback.proteinaImagenes }
    for (const [id, url] of Object.entries(parsedProt)) {
      proteinaImagenes[id as Proteina] = url
    }

    return { heroSlides, menuBannerUrl, categoriaImagenes, proteinaImagenes }
  } catch {
    return fallback
  }
}
