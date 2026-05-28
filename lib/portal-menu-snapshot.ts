import type { OrderItem } from "@/components/orders-provider"
import {
  bebidaTamanoLabels,
  bebidas,
  categorias,
  getPlatillosForCategoria,
  proteinas,
  type BebidaTamano,
  type Proteina,
} from "@/lib/menu-data"
import type { MenuCatalogHelpers } from "@/lib/menu-catalog-shared"
import { cartLineKey } from "@/lib/order-item-extras"
import { defaultPlatilloCustomizationConfig } from "@/lib/order-item-customizations"
import {
  PORTAL_INCOMPLETE_BEBIDA_CHOICE_SUFFIX,
  PORTAL_INCOMPLETE_BEBIDA_SUFFIX,
  PORTAL_INCOMPLETE_PROTEIN_SUFFIX,
  cartItemSupportsProtein,
} from "@/lib/portal-cart-item"

/** One line the AI should return (before server resolves prices). */
export type PortalAiLineInput = {
  categoriaId: string
  platilloId?: string
  proteina?: string
  bebidaId?: string
  bebidaTamano?: BebidaTamano
  cantidad: number
  notas?: string
}

export type PortalMenuSnapshotLine = {
  categoriaId: string
  platilloId: string
  nombre: string
  proteina?: Proteina
  precio: number
  bebidaId?: string
  bebidaTamano?: BebidaTamano
}

/** Compact menu text + price list for the order-taking AI. */
export function buildPortalMenuSnapshot(catalog: MenuCatalogHelpers): string {
  const lines: string[] = []

  for (const categoria of categorias) {
    if (catalog.isCategoriaHidden(categoria.id) || catalog.isCategoriaOut(categoria.id)) {
      continue
    }
    for (const platillo of getPlatillosForCategoria(categoria)) {
      if (
        catalog.isPlatilloHidden(categoria.id, platillo.id) ||
        catalog.isPlatilloOut(categoria.id, platillo.id)
      ) {
        continue
      }
      if (platillo.tieneProteinas === false) {
        const precio = catalog.getPlatilloPrecio(categoria.id, platillo.id)
        lines.push(
          `- ${platillo.nombre} | categoriaId=${categoria.id} platilloId=${platillo.id} | $${precio} (sin proteína)`,
        )
        continue
      }
      for (const proteina of proteinas) {
        if (catalog.isProteinaOut(categoria.id, proteina, platillo.id)) continue
        if (catalog.isProteinaHidden(categoria.id, proteina, platillo.id)) continue
        const precio = catalog.getPrecioConProteina(
          categoria.id,
          proteina,
          platillo.id,
        )
        lines.push(
          `- ${platillo.nombre} ${proteina} | categoriaId=${categoria.id} platilloId=${platillo.id} proteina=${proteina} | $${precio}`,
        )
      }
    }
  }

  lines.push("\nBebidas (bebidaTamano: chico | grande):")
  for (const bebida of catalog.getBebidas()) {
    if (catalog.isBebidaHidden(bebida.id) || catalog.isBebidaOut(bebida.id)) continue
    for (const tam of ["chico", "grande"] as const) {
      const precio = catalog.getBebidaPrecio(bebida.id, tam)
      lines.push(
        `- ${bebida.nombre} (${bebidaTamanoLabels[tam]}) | categoriaId=bebidas bebidaId=${bebida.id} bebidaTamano=${tam} | $${precio}`,
      )
    }
  }

  return lines.join("\n")
}

function normalizeProteina(raw: string | undefined): Proteina | undefined {
  if (!raw?.trim()) return undefined
  const t = raw.trim()
  const match = proteinas.find(
    (p) => p.toLowerCase() === t.toLowerCase() || p === t,
  )
  return match
}

function platilloDisplayName(
  categoriaId: string,
  platilloId: string,
  proteina?: Proteina,
): string {
  const cat = categorias.find((c) => c.id === categoriaId)
  if (!cat) return platilloId
  const platillo = getPlatillosForCategoria(cat).find((p) => p.id === platilloId)
  const base = platillo?.nombre ?? cat.nombre
  return proteina ? `${base} de ${proteina}` : base
}

/** Turn AI JSON lines into `OrderItem[]`, merging quantities on matching lines. */
export function resolvePortalAiLines(
  lines: PortalAiLineInput[],
  catalog: MenuCatalogHelpers,
): { items: OrderItem[]; errors: string[] } {
  const errors: string[] = []
  const byId = new Map<string, OrderItem>()

  for (const line of lines) {
    const qty = Math.max(1, Math.floor(line.cantidad || 1))
    const notas = line.notas?.trim() || undefined

    if (line.categoriaId === "bebidas" || line.bebidaId) {
      const bebidaId = line.bebidaId
      if (!bebidaId) {
        const tamPreset =
          line.bebidaTamano === "grande"
            ? "grande"
            : line.bebidaTamano === "chico"
              ? "chico"
              : null
        const itemId = tamPreset
          ? `elige-${tamPreset}-${PORTAL_INCOMPLETE_BEBIDA_CHOICE_SUFFIX}`
          : `elige-${PORTAL_INCOMPLETE_BEBIDA_CHOICE_SUFFIX}`
        const nombre = tamPreset
          ? `Bebida (elige sabor) — ${bebidaTamanoLabels[tamPreset]}`
          : "Bebida (elige sabor)"
        const precio = 25
        const existing = byId.get(itemId)
        if (existing) {
          existing.cantidad += qty
        } else {
          byId.set(itemId, {
            id: itemId,
            categoria: "bebidas",
            nombre,
            cantidad: qty,
            precio,
            notas,
            needsBebidaEleccion: true,
            needsBebidaTamano: tamPreset == null,
          })
        }
        continue
      }
      const bebida = catalog.findBebida(bebidaId)
      if (!bebida) {
        const tamPreset =
          line.bebidaTamano === "grande"
            ? "grande"
            : line.bebidaTamano === "chico"
              ? "chico"
              : null
        const itemId = tamPreset
          ? `elige-${tamPreset}-${PORTAL_INCOMPLETE_BEBIDA_CHOICE_SUFFIX}`
          : `elige-${PORTAL_INCOMPLETE_BEBIDA_CHOICE_SUFFIX}`
        const nombre = tamPreset
          ? `Bebida (elige sabor) — ${bebidaTamanoLabels[tamPreset]}`
          : "Bebida (elige sabor)"
        const precio = 25
        const existing = byId.get(itemId)
        if (existing) {
          existing.cantidad += qty
        } else {
          byId.set(itemId, {
            id: itemId,
            categoria: "bebidas",
            nombre,
            cantidad: qty,
            precio,
            notas,
            needsBebidaEleccion: true,
            needsBebidaTamano: tamPreset == null,
          })
        }
        continue
      }
      const tam =
        line.bebidaTamano === "grande"
          ? "grande"
          : line.bebidaTamano === "chico"
            ? "chico"
            : null

      if (tam == null) {
        const itemId = `${bebidaId}-${PORTAL_INCOMPLETE_BEBIDA_SUFFIX}`
        const precio = catalog.getBebidaPrecio(bebidaId, "chico")
        const existing = byId.get(itemId)
        if (existing) {
          existing.cantidad += qty
        } else {
          byId.set(itemId, {
            id: itemId,
            categoria: "bebidas",
            nombre: `${bebida.nombre} (elige tamaño)`,
            cantidad: qty,
            precio,
            notas,
            needsBebidaTamano: true,
            bebidaId,
          })
        }
        continue
      }

      const precio = catalog.getBebidaPrecio(bebidaId, tam)
      const itemId = `${bebidaId}-${tam}`
      const nombre = `${bebida.nombre} (${bebidaTamanoLabels[tam]})`
      const existing = byId.get(itemId)
      if (existing) {
        existing.cantidad += qty
      } else {
        byId.set(itemId, {
          id: itemId,
          categoria: "bebidas",
          nombre,
          cantidad: qty,
          precio,
          notas,
          bebidaId,
        })
      }
      continue
    }

    const categoriaId = line.categoriaId
    const cat = categorias.find((c) => c.id === categoriaId)
    if (!cat) {
      errors.push(`Categoría desconocida: ${categoriaId}`)
      continue
    }
    const platilloId = line.platilloId ?? categoriaId
    const platillo = getPlatillosForCategoria(cat).find((p) => p.id === platilloId)
    const proteina = normalizeProteina(line.proteina)

    let precio: number
    let nombre: string

    if (platillo?.tieneProteinas !== false && !proteina) {
      const baseName = platilloDisplayName(categoriaId, platilloId)
      const config = defaultPlatilloCustomizationConfig()
      const baseId = `${categoriaId}-${platilloId}-${PORTAL_INCOMPLETE_PROTEIN_SUFFIX}`
      const itemId = cartLineKey(baseId, [], notas ?? "", config)
      const precio = catalog.getPlatilloPrecio(categoriaId, platilloId)
      const existing = byId.get(itemId)
      if (existing) {
        existing.cantidad += qty
      } else {
        byId.set(itemId, {
          id: itemId,
          categoria: categoriaId,
          nombre: `${baseName} (elige proteína)`,
          cantidad: qty,
          precio,
          notas,
          needsProteina: true,
        })
      }
      continue
    }

    if (platillo?.tieneProteinas === false || !proteina) {
      precio = catalog.getPlatilloPrecio(categoriaId, platilloId)
      nombre = platilloDisplayName(categoriaId, platilloId)
    } else {
      precio = catalog.getPrecioConProteina(categoriaId, proteina, platilloId)
      nombre = platilloDisplayName(categoriaId, platilloId, proteina)
    }

    const config = defaultPlatilloCustomizationConfig()
    const baseId = `${categoriaId}-${platilloId}-${proteina || "default"}`
    const itemId = cartLineKey(baseId, [], notas ?? "", config)
    const existing = byId.get(itemId)
    if (existing) {
      existing.cantidad += qty
    } else {
      byId.set(itemId, {
        id: itemId,
        categoria: categoriaId,
        nombre,
        proteina,
        cantidad: qty,
        precio,
        notas,
      })
    }
  }

  return { items: [...byId.values()], errors }
}

export function mergeOrderItems(
  base: OrderItem[],
  incoming: OrderItem[],
  mode: "replace" | "append",
): OrderItem[] {
  if (mode === "replace") return incoming
  const byId = new Map<string, OrderItem>()
  for (const item of base) byId.set(item.id, { ...item })
  for (const item of incoming) {
    const existing = byId.get(item.id)
    if (existing) {
      existing.cantidad += item.cantidad
      if (item.notas && !existing.notas) existing.notas = item.notas
    } else {
      byId.set(item.id, { ...item })
    }
  }
  return [...byId.values()]
}

export function orderItemsTotal(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + i.precio * i.cantidad, 0)
}

export type PortalOrderLineBreakdown = {
  id: string
  nombre: string
  cantidad: number
  precio: number
  subtotal: number
  notas?: string
  proteina?: Proteina
  tieneProteinas: boolean
  needsProteina: boolean
  needsBebidaTamano: boolean
  needsBebidaEleccion: boolean
  bebidaId?: string
}

export function buildPortalOrderLineBreakdown(
  items: OrderItem[],
): PortalOrderLineBreakdown[] {
  return items.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    cantidad: i.cantidad,
    precio: i.precio,
    subtotal: i.precio * i.cantidad,
    notas: i.notas,
    proteina: i.proteina,
    tieneProteinas: cartItemSupportsProtein(i) || Boolean(i.needsProteina),
    needsProteina: Boolean(i.needsProteina),
    needsBebidaTamano: Boolean(i.needsBebidaTamano),
    needsBebidaEleccion: Boolean(i.needsBebidaEleccion),
    bebidaId: i.bebidaId,
  }))
}
