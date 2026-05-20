import type { HeroSlide } from "@/lib/home-hero-slides"

/** Unique id for a new hero carousel slide (avoids duplicate React keys). */
export function newHeroSlideId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `slide-${crypto.randomUUID()}`
  }
  return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Guarantee every slide has a distinct id (fixes legacy slide-1…4 collisions). */
export function ensureUniqueHeroSlides(slides: HeroSlide[]): HeroSlide[] {
  const seen = new Set<string>()
  return slides.map((slide, index) => {
    let id = slide.id?.trim() || `slide-${index + 1}`
    if (seen.has(id)) {
      id = newHeroSlideId()
    }
    seen.add(id)
    return { ...slide, id }
  })
}
