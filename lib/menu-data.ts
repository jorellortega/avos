export const proteinas = [
  "Asada",
  "Pollo",
  "Pastor",
  "Chorizo",
  "Carnitas",
  "Camarón",
] as const
export type Proteina = (typeof proteinas)[number]

/** Sin carne — solo en platillos que lo incluyen en `proteinas` (ej. chilaquiles). */
export const PROTEINA_REGULAR = "Regular" as const
export type ProteinaPlatillo = Proteina | typeof PROTEINA_REGULAR

export function isProteinaRegular(
  proteina: string | undefined,
): proteina is typeof PROTEINA_REGULAR {
  return proteina === PROTEINA_REGULAR
}

/** Fallback protein thumbnails. Live URLs: `ai_settings.public_proteina_imagenes` (edit at /edit as CEO). */
const PROTEINA_IMG_PLACEHOLDER = "/placeholder.svg"
export const imagenProteinaPorId: Record<Proteina, string> = {
  Asada: PROTEINA_IMG_PLACEHOLDER,
  Pollo: PROTEINA_IMG_PLACEHOLDER,
  Pastor: PROTEINA_IMG_PLACEHOLDER,
  Chorizo: PROTEINA_IMG_PLACEHOLDER,
  Carnitas: PROTEINA_IMG_PLACEHOLDER,
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
    descripcion: "Cebolla asada, aguacate, cilantro — elige tamaño y proteína",
    imagen: "/tacos.png",
    precioBase: 15,
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
    descripcion: "Arroz, frijoles, cebolla asada, aguacate, salsa de aguacate — elige tamaño y proteína",
    imagen: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
    precioBase: 95,
    tieneProteinas: true,
  },
  {
    id: "quesadillas",
    nombre: "Quesadillas",
    descripcion: "Queso, cebolla asada, aguacate — elige tamaño y proteína",
    imagen: "/quesadillas.png",
    precioBase: 42,
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
  {
    id: "carne-asada-fries",
    nombre: "Carne Asada Fries",
    descripcion: "Papas fritas con guacamole, crema y queso — elige tamaño y proteína",
    imagen: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
    precioBase: 62,
    tieneProteinas: true,
  },
  {
    id: "menu-infantil",
    nombre: "Menú Infantil",
    descripcion: "¡Hecho especialmente para nuestros pequeños!",
    imagen: "/menu-infantil.png",
    precioBase: 60,
    tieneProteinas: false,
  },
  {
    id: "acompanamientos",
    nombre: "Acompañamientos",
    descripcion: "Papas, guacamole, arroz y frijoles extra",
    imagen: "/placeholder.svg",
    precioBase: 25,
    tieneProteinas: false,
  },
  {
    id: "proteina-extra",
    nombre: "Proteína Extra",
    descripcion: "Orden extra de proteína en vaso",
    imagen: "/placeholder.svg",
    precioBase: 35,
    tieneProteinas: false,
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
  /** Chico / Grande (ej. Carne Asada Fries) */
  tieneTamanos?: boolean
  precioChico?: number
  precioGrande?: number
  /** Override size button labels (ej. Pequeño / Grande, 4 pzs / 8 pzs) */
  tamanoLabelChico?: string
  tamanoLabelGrande?: string
  /** Choose-one options instead of protein (ej. fruta en plato infantil) */
  opciones?: readonly PlatilloOpcion[]
  /** Absolute price per protein and size (ej. Carne Asada Fries, Tacos) */
  preciosProteinaTamano?: ProteinaTamanoPrecios
  /** Limit protein picker (ej. tacos: sin Pastor; chilaquiles incluye Regular) */
  proteinas?: readonly ProteinaPlatillo[]
}

export type PlatilloOpcion = {
  id: string
  label: string
}

export type ProteinaTamanoPrecios = Partial<
  Record<ProteinaPlatillo, Partial<Record<BebidaTamano, number>>>
>

/** Multiple menu items within one category (e.g. burrito styles). */
export const platillosPorCategoria: Partial<
  Record<string, readonly CategoriaPlatillo[]>
> = {
  tacos: [
    {
      id: "tacos",
      nombre: "Taco",
      descripcion: "Cebolla asada, aguacate, cilantro",
      precioBase: 15,
      tieneProteinas: true,
      tieneTamanos: true,
      precioChico: 15,
      precioGrande: 28,
      proteinas: ["Asada", "Pollo", "Chorizo", "Carnitas", "Camarón"],
      preciosProteinaTamano: {
        Asada: { chico: 18, grande: 28 },
        Pollo: { chico: 15, grande: 25 },
        Chorizo: { chico: 15, grande: 25 },
        Carnitas: { chico: 15, grande: 25 },
        Camarón: { chico: 25, grande: 35 },
      },
    },
  ],
  quesadillas: [
    {
      id: "quesadillas",
      nombre: "Quesadilla",
      descripcion: "Queso, cebolla asada, aguacate",
      precioBase: 42,
      tieneProteinas: true,
      tieneTamanos: true,
      precioChico: 42,
      precioGrande: 65,
      tamanoLabelChico: "Chica",
      tamanoLabelGrande: "Grande",
      proteinas: ["Asada", "Pollo", "Chorizo", "Carnitas"],
      preciosProteinaTamano: {
        Asada: { chico: 45, grande: 65 },
        Pollo: { chico: 42, grande: 62 },
        Chorizo: { chico: 42, grande: 62 },
        Carnitas: { chico: 42, grande: 62 },
      },
    },
  ],
  burritos: [
    {
      id: "burrito",
      nombre: "Burrito",
      descripcion: "Arroz, frijoles, cebolla asada, aguacate, salsa de aguacate",
      precioBase: 75,
      tieneProteinas: true,
      tieneTamanos: true,
      precioChico: 75,
      precioGrande: 95,
      tamanoLabelChico: "Chico",
      tamanoLabelGrande: "Grande",
      preciosProteinaTamano: {
        Asada: { chico: 78, grande: 98 },
        Pollo: { chico: 75, grande: 95 },
        Pastor: { chico: 75, grande: 95 },
        Chorizo: { chico: 73, grande: 93 },
        Carnitas: { chico: 75, grande: 95 },
        Camarón: { chico: 95, grande: 115 },
      },
    },
    {
      id: "california-burrito",
      nombre: "California Burrito",
      descripcion:
        "Carne, papas, queso, guacamole y salsa de aguacate",
      precioBase: 70,
      tieneProteinas: false,
      tieneTamanos: true,
      precioChico: 70,
      precioGrande: 90,
      tamanoLabelChico: "Chico",
      tamanoLabelGrande: "Grande",
    },
    {
      id: "breakfast-burrito",
      nombre: "Breakfast Burrito",
      descripcion: "Huevos, papas, queso, frijoles y salsa",
      precioBase: 76,
      tieneProteinas: false,
      tieneTamanos: true,
      precioChico: 76,
      precioGrande: 96,
      tamanoLabelChico: "Chico",
      tamanoLabelGrande: "Grande",
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
    {
      id: "chilaquiles",
      nombre: "Chilaquiles",
      descripcion:
        "Tortillas en salsa, crema, queso fresco y cebolla — elige tamaño y proteína",
      precioBase: 95,
      tieneProteinas: true,
      tieneTamanos: true,
      precioChico: 95,
      precioGrande: 120,
      tamanoLabelChico: "Chicos",
      tamanoLabelGrande: "Grandes",
      proteinas: [
        "Regular",
        "Asada",
        "Pollo",
        "Pastor",
        "Chorizo",
        "Carnitas",
        "Camarón",
      ],
      preciosProteinaTamano: {
        Regular: { chico: 95, grande: 120 },
        Asada: { chico: 98, grande: 120 },
        Pollo: { chico: 95, grande: 120 },
        Pastor: { chico: 95, grande: 120 },
        Chorizo: { chico: 95, grande: 120 },
        Carnitas: { chico: 95, grande: 120 },
        Camarón: { chico: 115, grande: 140 },
      },
    },
  ],
  "carne-asada-fries": [
    {
      id: "carne-asada-fries",
      nombre: "Carne Asada Fries",
      descripcion: "Papas fritas con guacamole, crema y queso — elige tamaño y proteína",
      precioBase: 62,
      tieneProteinas: true,
      tieneTamanos: true,
      precioChico: 62,
      precioGrande: 90,
      tamanoLabelChico: "Chicas",
      tamanoLabelGrande: "Grandes",
      preciosProteinaTamano: {
        Asada: { chico: 65, grande: 90 },
        Pollo: { chico: 62, grande: 87 },
        Pastor: { chico: 62, grande: 87 },
        Chorizo: { chico: 62, grande: 87 },
        Carnitas: { chico: 62, grande: 87 },
        Camarón: { chico: 82, grande: 107 },
      },
    },
  ],
  "menu-infantil": [
    {
      id: "plato-infantil",
      nombre: "Plato Infantil",
      descripcion:
        "Nuggets, papas, 1 fruta y bebida pequeña incluida — elige tamaño y fruta",
      precioBase: 60,
      tieneProteinas: false,
      tieneTamanos: true,
      precioChico: 60,
      precioGrande: 100,
      tamanoLabelChico: "Pequeño",
      tamanoLabelGrande: "Grande",
      opciones: [
        { id: "manzana", label: "Manzana" },
        { id: "platano", label: "Plátano" },
        { id: "naranja", label: "Naranja" },
      ],
    },
    {
      id: "papas-infantil",
      nombre: "Papas",
      descripcion: "Papas fritas crujientes",
      precioBase: 25,
      tieneProteinas: false,
      tieneTamanos: true,
      precioChico: 25,
      precioGrande: 50,
      tamanoLabelChico: "Pequeñas",
      tamanoLabelGrande: "Grandes",
    },
    {
      id: "nuggets-infantil",
      nombre: "Nuggets de Pollo",
      descripcion: "Nuggets de pollo empanizados",
      precioBase: 40,
      tieneProteinas: false,
      tieneTamanos: true,
      precioChico: 40,
      precioGrande: 80,
      tamanoLabelChico: "4 pzs",
      tamanoLabelGrande: "8 pzs",
    },
  ],
  "proteina-extra": [
    {
      id: "asada-vaso",
      nombre: "Asada (Vaso)",
      descripcion: "Carne asada extra en vaso",
      precioBase: 45,
      tieneProteinas: false,
    },
    {
      id: "pollo-vaso",
      nombre: "Pollo (Vaso)",
      descripcion: "Pollo extra en vaso",
      precioBase: 35,
      tieneProteinas: false,
    },
  ],
  acompanamientos: [
    {
      id: "papas-fritas",
      nombre: "Papas fritas",
      descripcion: "Orden de papas fritas",
      precioBase: 35,
      tieneProteinas: false,
      tieneTamanos: true,
      precioChico: 35,
      precioGrande: 55,
    },
    {
      id: "guacamole-extra",
      nombre: "Guacamole extra",
      descripcion: "Guacamole extra",
      precioBase: 45,
      tieneProteinas: false,
    },
    {
      id: "arroz",
      nombre: "Arroz",
      descripcion: "Orden de arroz",
      precioBase: 25,
      tieneProteinas: false,
      tieneTamanos: true,
      precioChico: 25,
      precioGrande: 45,
    },
    {
      id: "frijoles",
      nombre: "Frijoles",
      descripcion: "Orden de frijoles",
      precioBase: 25,
      tieneProteinas: false,
      tieneTamanos: true,
      precioChico: 25,
      precioGrande: 45,
    },
    {
      id: "tortillas-maiz",
      nombre: "Tortillas de maíz",
      descripcion: "Tortilla de maíz extra",
      precioBase: 2,
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

export function getProteinasForPlatillo(
  platillo: CategoriaPlatillo,
  categoria: Pick<CategoriaMenu, "tieneProteinas">,
): readonly ProteinaPlatillo[] {
  if (platillo.tieneProteinas === false) return []
  if (platillo.proteinas?.length) return platillo.proteinas
  if ((categoria as { tieneProteinas?: boolean }).tieneProteinas === false) {
    return []
  }
  return proteinas
}

export type OrdenarMenuItem = {
  id: string
  name: string
  basePrice: number
  shrimpExtra?: number
  tieneProteinas: boolean
  tieneTamanos?: boolean
  precioChico?: number
  precioGrande?: number
  tamanoLabelChico?: string
  tamanoLabelGrande?: string
  opciones?: readonly PlatilloOpcion[]
  proteins: readonly ProteinaPlatillo[]
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
    tieneProteinas:
      (p.opciones?.length ?? 0) > 0
        ? false
        : p.tieneProteinas === true
          ? true
          : p.tieneProteinas === false
            ? false
            : c.tieneProteinas !== false,
    tieneTamanos: p.tieneTamanos === true,
    precioChico: p.precioChico,
    precioGrande: p.precioGrande,
    tamanoLabelChico: p.tamanoLabelChico,
    tamanoLabelGrande: p.tamanoLabelGrande,
    opciones: p.opciones,
    proteins:
      p.tieneProteinas === false
        ? []
        : p.proteinas?.length
          ? [...p.proteinas]
          : proteinas,
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

export function platilloTieneTamanos(p: CategoriaPlatillo): boolean {
  return p.tieneTamanos === true
}

export function getPlatilloPrecioDefault(
  platillo: Pick<CategoriaPlatillo, "precioBase" | "precioChico" | "precioGrande" | "tieneTamanos">,
  tamano: BebidaTamano,
): number {
  if (platillo.tieneTamanos) {
    return tamano === "chico"
      ? (platillo.precioChico ?? platillo.precioBase)
      : (platillo.precioGrande ?? platillo.precioBase)
  }
  return platillo.precioBase
}

export function getPlatilloTamanoLabel(
  platillo: Pick<CategoriaPlatillo, "tamanoLabelChico" | "tamanoLabelGrande">,
  tamano: BebidaTamano,
): string {
  if (tamano === "chico") {
    return platillo.tamanoLabelChico ?? bebidaTamanoLabels.chico
  }
  return platillo.tamanoLabelGrande ?? bebidaTamanoLabels.grande
}

/** e.g. "Pequeño $60 · Grande $100" */
export function formatPlatilloTamanoPrecioRange(
  platillo: Pick<
    CategoriaPlatillo,
    | "precioBase"
    | "precioChico"
    | "precioGrande"
    | "tamanoLabelChico"
    | "tamanoLabelGrande"
    | "tieneTamanos"
  >,
  precioChico?: number,
  precioGrande?: number,
): string {
  if (platillo.tieneTamanos !== true) return `$${platillo.precioBase}`
  const pChico = precioChico ?? platillo.precioChico ?? platillo.precioBase
  const pGrande = precioGrande ?? platillo.precioGrande ?? platillo.precioBase
  const chico = getPlatilloTamanoLabel(platillo, "chico")
  const grande = getPlatilloTamanoLabel(platillo, "grande")
  return `${chico} $${pChico} · ${grande} $${pGrande}`
}

export function getPlatilloPrecioProteinaTamanoDefault(
  platillo: Pick<
    CategoriaPlatillo,
    | "preciosProteinaTamano"
    | "precioBase"
    | "precioChico"
    | "precioGrande"
    | "tieneTamanos"
  >,
  proteina: ProteinaPlatillo,
  tamano: BebidaTamano,
  camarónExtra = 20,
): number {
  const matrix = platillo.preciosProteinaTamano?.[proteina]?.[tamano]
  if (typeof matrix === "number" && Number.isFinite(matrix)) return matrix
  const base = platillo.tieneTamanos
    ? getPlatilloPrecioDefault(platillo, tamano)
    : platillo.precioBase
  return getPrecioConProteina(base, proteina, camarónExtra)
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

export function getPrecioConProteina(
  precioBase: number,
  proteina: ProteinaPlatillo,
  camarónExtra = 20,
): number {
  if (proteina === "Camarón") {
    return precioBase + camarónExtra
  }
  return precioBase
}
