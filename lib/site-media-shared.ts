import { homeHeroSlides, type HeroSlide } from "@/lib/home-hero-slides"
import {
  categorias,
  imagenProteinaPorId,
  type Proteina,
} from "@/lib/menu-data"

export const SITE_MEDIA_KEYS = {
  heroSlides: "public_hero_slides",
  menuBanner: "public_menu_banner",
  categoriaImagenes: "public_menu_categoria_imagenes",
  proteinaImagenes: "public_proteina_imagenes",
} as const

const DEFAULT_MENU_BANNER =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png"

export type SiteMedia = {
  heroSlides: HeroSlide[]
  menuBannerUrl: string
  categoriaImagenes: Record<string, string>
  /** Asada, Pollo, Pastor, Camarón — used in protein pickers */
  proteinaImagenes: Record<Proteina, string>
}

export function defaultSiteMedia(): SiteMedia {
  const categoriaImagenes: Record<string, string> = {}
  for (const c of categorias) {
    categoriaImagenes[c.id] = c.imagen
  }
  return {
    heroSlides: [...homeHeroSlides],
    menuBannerUrl: DEFAULT_MENU_BANNER,
    categoriaImagenes,
    proteinaImagenes: { ...imagenProteinaPorId },
  }
}
