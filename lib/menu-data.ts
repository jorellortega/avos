export const proteinas = ["Asada", "Pollo", "Pastor", "Camarón"] as const
export type Proteina = (typeof proteinas)[number]

/** Fallback protein thumbnails. Live URLs: `ai_settings.public_proteina_imagenes` (edit at /edit as CEO). */
const PROTEINA_IMG_PLACEHOLDER = "/placeholder.svg"
export const imagenProteinaPorId: Record<Proteina, string> = {
  Asada: PROTEINA_IMG_PLACEHOLDER,
  Pollo: PROTEINA_IMG_PLACEHOLDER,
  Pastor: PROTEINA_IMG_PLACEHOLDER,
  Camarón: PROTEINA_IMG_PLACEHOLDER,
}

export interface MenuItem {
  id: string
  categoria: string
  nombre: string
  descripcion: string
  precio: number
  imagen: string
}

export const categorias = [
  {
    id: "tacos",
    nombre: "Tacos",
    descripcion: "Cebolla asada, aguacate, cilantro",
    imagen: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
    precioBase: 45,
    tieneProteinas: true,
  },
  {
    id: "tortas",
    nombre: "Tortas",
    descripcion: "Frijoles, queso, cebolla asada, aguacate",
    imagen: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
    precioBase: 85,
    tieneProteinas: true,
  },
  {
    id: "burritos",
    nombre: "Burritos",
    descripcion: "Arroz, frijoles, cebolla asada, aguacate, salsa de aguacate",
    imagen: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
    precioBase: 95,
    tieneProteinas: true,
  },
  {
    id: "quesadillas",
    nombre: "Quesadillas",
    descripcion: "Queso, cebolla asada, aguacate",
    imagen: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
    precioBase: 75,
    tieneProteinas: true,
  },
  {
    id: "platillos",
    nombre: "Platillos",
    descripcion: "Arroz, frijoles, cebolla asada, rebanadas de aguacate + salsa de aguacate, tortillas",
    imagen: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
    precioBase: 120,
    tieneProteinas: true,
  },
] as const

/** Key used in `public_menu_categoria_imagenes` JSON and ordenar grid */
export const BEBIDAS_CATEGORIA_ID = "bebidas" as const

/** Default thumbnail for Bebidas (override via CEO site media or `ai_settings`) */
export const imagenCategoriaBebidas =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png"

export type CategoriaMenu = (typeof categorias)[number]

export function getCategoriaById(id: string): CategoriaMenu | undefined {
  return categorias.find((c) => c.id === id)
}

/** Flat tabs data for `/ordenar` (one configurable item per category) */
export type OrdenarMenuItem = {
  name: string
  basePrice: number
  shrimpExtra?: number
  proteins: readonly Proteina[]
}

export type OrdenarMenuCategory = {
  id: string
  name: string
  description: string
  items: OrdenarMenuItem[]
}

export const menuCategories: OrdenarMenuCategory[] = categorias.map((c) => ({
  id: c.id,
  name: c.nombre,
  description: c.descripcion,
  items: [
    {
      name: c.nombre,
      basePrice: c.precioBase,
      shrimpExtra: 20,
      proteins: proteinas,
    },
  ],
}))

export const bebidas = [
  { id: "jamaica", nombre: "Agua de Jamaica", precio: 35 },
  { id: "pina", nombre: "Agua de Piña", precio: 35 },
  { id: "limon-pepino", nombre: "Agua de Limón & Pepino", precio: 35 },
  { id: "mango", nombre: "Agua de Mango", precio: 35 },
] as const

export type BebidaOrdenar = { id: string; name: string; price: number }

export const bebidasOrdenar: BebidaOrdenar[] = bebidas.map((b) => ({
  id: b.id,
  name: b.nombre,
  price: b.precio,
}))

export function getPrecioConProteina(precioBase: number, proteina: Proteina): number {
  if (proteina === "Camarón") {
    return precioBase + 20
  }
  return precioBase
}
