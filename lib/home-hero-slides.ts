export interface HeroSlide {
  id: string
  /** Image URL — replace with database or CMS URLs later */
  src: string
  alt: string
}

/** Placeholder slides for the homepage hero carousel */
export const homeHeroSlides: HeroSlide[] = [
  {
    id: "slide-1",
    src: "/placeholder.jpg",
    alt: "Comida mexicana en Avos",
  },
  {
    id: "slide-2",
    src: "/placeholder-user.jpg",
    alt: "Especialidades de la casa",
  },
  {
    id: "slide-3",
    src: "/placeholder.jpg",
    alt: "Tacos y platillos frescos",
  },
  {
    id: "slide-4",
    src: "/placeholder-user.jpg",
    alt: "Sabor estilo California",
  },
]
