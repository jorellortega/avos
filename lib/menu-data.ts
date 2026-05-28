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
export type CategoriaPlatillo = {
  id: string
  nombre: string
  descripcion: string
  precioBase: number
  /** false = precio fijo, sin selector de proteína */
  tieneProteinas?: boolean
}

/** Multiple menu items within one category (e.g. burrito styles). */
export const platillosPorCategoria: Partial<
  Record<string, readonly CategoriaPlatillo[]>
> = {
  burritos: [
    {
      id: "burrito",
      nombre: "Burrito",
      descripcion: "Arroz, frijoles, cebolla asada, aguacate, salsa de aguacate",
      precioBase: 95,
    },
    {
      id: "california-burrito",
      nombre: "California Burrito",
      descripcion:
        "Carne, papas, queso, guacamole y salsa de aguacate",
      precioBase: 95,
      tieneProteinas: false,
    },
    {
      id: "breakfast-burrito",
      nombre: "Breakfast Burrito",
      descripcion: "Huevos, papas, queso, frijoles y salsa",
      precioBase: 95,
      tieneProteinas: false,
    },
  ],
  platillos: [
    {
      id: "platillo",
      nombre: "Platillo",
      descripcion:
        "Arroz, frijoles, cebolla asada, rebanadas de aguacate + salsa de aguacate, tortillas",
      precioBase: 120,
    },
    {
      id: "menudo",
      nombre: "Menudo",
      descripcion: "Sopa tradicional de pancita de res",
      precioBase: 120,
      tieneProteinas: false,
    },
    {
      id: "pozole",
      nombre: "Pozole",
      descripcion: "Sopa de maíz con carne, lechuga, rábano y orégano",
      precioBase: 120,
      tieneProteinas: false,
    },
  ],
}

export function getPlatillosForCategoria(
  categoria: CategoriaMenu,
): CategoriaPlatillo[] {
  const custom = platillosPorCategoria[categoria.id]
  if (custom && custom.length > 0) return [...custom]
  return [
    {
      id: categoria.id,
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      precioBase: categoria.precioBase,
      tieneProteinas: categoria.tieneProteinas,
    },
  ]
}

export type OrdenarMenuItem = {
  id: string
  name: string
  basePrice: number
  shrimpExtra?: number
  tieneProteinas: boolean
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
  items: getPlatillosForCategoria(c).map((p) => ({
    id: p.id,
    name: p.nombre,
    basePrice: p.precioBase,
    shrimpExtra: 20,
    tieneProteinas: p.tieneProteinas !== false,
    proteins: p.tieneProteinas === false ? [] : proteinas,
  })),
}))

export type BebidaTamano = "chico" | "grande"

export const bebidaTamanoLabels: Record<BebidaTamano, string> = {
  chico: "Chico",
  grande: "Grande",
}

export const bebidas = [
  { id: "jamaica", nombre: "Agua de Jamaica", precioChico: 25, precioGrande: 35 },
  { id: "pina", nombre: "Agua de Piña", precioChico: 25, precioGrande: 35 },
  {
    id: "limon-pepino",
    nombre: "Agua de Limón & Pepino",
    precioChico: 25,
    precioGrande: 35,
  },
  { id: "mango", nombre: "Agua de Mango", precioChico: 25, precioGrande: 35 },
  { id: "alfalfa", nombre: "Agua de Alfalfa", precioChico: 25, precioGrande: 35 },
  { id: "naranja", nombre: "Agua de Naranja", precioChico: 25, precioGrande: 35 },
  { id: "horchata", nombre: "Horchata", precioChico: 25, precioGrande: 35 },
  { id: "melon", nombre: "Agua de Melón", precioChico: 25, precioGrande: 35 },
  { id: "sandia", nombre: "Agua de Sandía", precioChico: 25, precioGrande: 35 },
  { id: "michelada", nombre: "Michelada", precioChico: 25, precioGrande: 35 },
] as const

export type BebidaMenu = (typeof bebidas)[number]

export type BebidaPrecios = {
  precioChico: number
  precioGrande: number
}

export function getBebidaPrecioDefault(
  bebida: BebidaPrecios,
  tamano: BebidaTamano,
): number {
  return tamano === "chico" ? bebida.precioChico : bebida.precioGrande
}

export type BebidaOrdenar = {
  id: string
  name: string
  priceChico: number
  priceGrande: number
}

export const bebidasOrdenar: BebidaOrdenar[] = bebidas.map((b) => ({
  id: b.id,
  name: b.nombre,
  priceChico: b.precioChico,
  priceGrande: b.precioGrande,
}))

export function getPrecioConProteina(precioBase: number, proteina: Proteina): number {
  if (proteina === "Camarón") {
    return precioBase + 20
  }
  return precioBase
}
