import type { OrderItem } from "@/components/orders-provider"
import {
  bebidaTamanoLabels,
  bebidas,
  categorias,
  getPlatillosForCategoria,
  getPlatilloTamanoLabel,
  getProteinasForPlatillo,
  proteinas,
  type BebidaTamano,
  type Proteina,
} from "@/lib/menu-data"
import type { MenuCatalogHelpers } from "@/lib/menu-catalog-shared"
import { cartLineKey } from "@/lib/order-item-extras"
import { defaultPlatilloCustomizationConfig } from "@/lib/order-item-customizations"
import {
  platilloCartSuffix,
  platilloLineNombre,
  categoriaTieneProteinas,
  platilloPickerFlags,
} from "@/lib/platillo-config"
import {
  PORTAL_INCOMPLETE_BEBIDA_CHOICE_SUFFIX,
  PORTAL_INCOMPLETE_BEBIDA_SUFFIX,
  PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX,
  PORTAL_INCOMPLETE_PROTEIN_SUFFIX,
  cartItemNeedsCompletion,
  cartItemSupportsProtein,
  parseCartLineBaseId,
} from "@/lib/portal-cart-item"

/** One line the AI should return (before server resolves prices). */
export type PortalAiLineInput = {
  categoriaId: string
  platilloId?: string
  platilloTamano?: BebidaTamano
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
        if (platillo.tieneTamanos) {
          for (const tam of ["chico", "grande"] as const) {
            const precio = catalog.getPlatilloPrecioTamano(
              categoria.id,
              platillo.id,
              tam,
            )
            lines.push(
              `- ${platillo.nombre} (${bebidaTamanoLabels[tam]}) | categoriaId=${categoria.id} platilloId=${platillo.id} platilloTamano=${tam} | $${precio} (sin proteína)`,
            )
          }
        } else {
          const precio = catalog.getPlatilloPrecio(categoria.id, platillo.id)
          lines.push(
            `- ${platillo.nombre} | categoriaId=${categoria.id} platilloId=${platillo.id} | $${precio} (sin proteína)`,
          )
        }
        continue
      }
      if (platillo.tieneTamanos) {
        for (const tam of ["chico", "grande"] as const) {
          for (const proteina of getProteinasForPlatillo(platillo, categoria)) {
            if (catalog.isProteinaOut(categoria.id, proteina, platillo.id)) continue
            if (catalog.isProteinaHidden(categoria.id, proteina, platillo.id)) {
              continue
            }
            const precio = catalog.getPrecioConProteina(
              categoria.id,
              proteina,
              platillo.id,
              tam,
            )
            lines.push(
              `- ${platillo.nombre} (${getPlatilloTamanoLabel(platillo, tam)}) ${proteina} | categoriaId=${categoria.id} platilloId=${platillo.id} platilloTamano=${tam} proteina=${proteina} | $${precio}`,
            )
          }
        }
        continue
      }
      for (const proteina of getProteinasForPlatillo(platillo, categoria)) {
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
    const flags = platillo
      ? platilloPickerFlags(platillo, cat)
      : { tieneProteinas: categoriaTieneProteinas(cat), tieneTamanos: false, tieneOpciones: false }
    const proteina = normalizeProteina(line.proteina)
    const tam =
      line.platilloTamano === "grande" || line.platilloTamano === "chico"
        ? line.platilloTamano
        : undefined

    let precio: number
    let nombre: string

    if (flags.tieneTamanos && !tam) {
      const baseName = platilloDisplayName(categoriaId, platilloId)
      const config = defaultPlatilloCustomizationConfig()
      const needsProteina = flags.tieneProteinas && !proteina
      const baseId = needsProteina
        ? `${categoriaId}-${platilloId}-${PORTAL_INCOMPLETE_PROTEIN_SUFFIX}`
        : proteina
          ? `${categoriaId}-${platilloId}-${proteina}-${PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX}`
          : `${categoriaId}-${platilloId}-${PORTAL_INCOMPLETE_PLATILLO_TAMANO_SUFFIX}`
      const itemId = cartLineKey(baseId, [], notas ?? "", config)
      const incompletePrecio = proteina
        ? catalog.getPrecioConProteina(
            categoriaId,
            proteina,
            platilloId,
            "chico",
          )
        : catalog.getPlatilloPrecioTamano(categoriaId, platilloId, "chico")
      nombre = needsProteina
        ? `${baseName} (elige proteína y tamaño)`
        : proteina
          ? `${baseName} de ${proteina} (elige tamaño)`
          : `${baseName} (elige tamaño)`
      const existing = byId.get(itemId)
      if (existing) {
        existing.cantidad += qty
      } else {
        byId.set(itemId, {
          id: itemId,
          categoria: categoriaId,
          nombre,
          cantidad: qty,
          precio: incompletePrecio,
          notas,
          proteina: proteina ?? undefined,
          needsProteina,
          needsPlatilloTamano: true,
        })
      }
      continue
    }

    if (flags.tieneProteinas && !proteina) {
      const baseName = platilloDisplayName(categoriaId, platilloId)
      const config = defaultPlatilloCustomizationConfig()
      const baseId = `${categoriaId}-${platilloId}-${PORTAL_INCOMPLETE_PROTEIN_SUFFIX}`
      const itemId = cartLineKey(baseId, [], notas ?? "", config)
      const incompletePrecio = flags.tieneTamanos && tam
        ? catalog.getPlatilloPrecioTamano(categoriaId, platilloId, tam)
        : catalog.getPlatilloPrecio(categoriaId, platilloId)
      const existing = byId.get(itemId)
      if (existing) {
        existing.cantidad += qty
      } else {
        byId.set(itemId, {
          id: itemId,
          categoria: categoriaId,
          nombre: `${baseName} (elige proteína)`,
          cantidad: qty,
          precio: incompletePrecio,
          notas,
          needsProteina: true,
        })
      }
      continue
    }

    if (!flags.tieneProteinas) {
      const platilloMeta = platillo ?? undefined
      if (flags.tieneTamanos && tam) {
        precio = catalog.getPlatilloPrecioTamano(categoriaId, platilloId, tam)
        nombre = platilloLineNombre(
          platilloDisplayName(categoriaId, platilloId),
          flags,
          tam,
          undefined,
          platilloMeta,
        )
      } else {
        precio = catalog.getPlatilloPrecio(categoriaId, platilloId)
        nombre = platilloDisplayName(categoriaId, platilloId)
      }
    } else if (proteina) {
      precio = catalog.getPrecioConProteina(
        categoriaId,
        proteina,
        platilloId,
        flags.tieneTamanos ? tam : undefined,
      )
      nombre = platilloLineNombre(
        platilloDisplayName(categoriaId, platilloId),
        flags,
        tam,
        proteina,
        platillo,
      )
    } else {
      precio = catalog.getPlatilloPrecio(categoriaId, platilloId)
      nombre = platilloDisplayName(categoriaId, platilloId)
    }

    const config = defaultPlatilloCustomizationConfig()
    const baseId = `${categoriaId}-${platilloId}-${platilloCartSuffix(flags, tam, proteina)}`
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

  return { items: consolidatePlatilloCartLines([...byId.values()]), errors }
}

function platilloGroupKey(item: OrderItem): string | null {
  const parsed = parseCartLineBaseId(item.id)
  if (!parsed) return null
  return `${parsed.categoriaId}:${parsed.platilloId}`
}

function lineCompletionScore(item: OrderItem): number {
  if (!cartItemNeedsCompletion(item)) return 100
  let score = 0
  if (!item.needsProteina) score += 50
  if (item.proteina) score += 5
  if (!item.needsPlatilloTamano) score += 50
  if (!item.needsBebidaTamano) score += 40
  if (!item.needsBebidaEleccion) score += 40
  return score
}

/** One cart line per platillo when duplicates differ only by missing protein/size. */
export function consolidatePlatilloCartLines(items: OrderItem[]): OrderItem[] {
  const platilloGroups = new Map<string, OrderItem[]>()
  const others: OrderItem[] = []

  for (const item of items) {
    const key = platilloGroupKey(item)
    if (!key) {
      others.push(item)
      continue
    }
    const group = platilloGroups.get(key) ?? []
    group.push(item)
    platilloGroups.set(key, group)
  }

  const consolidated: OrderItem[] = [...others]

  for (const [, group] of platilloGroups) {
    if (group.length === 1) {
      consolidated.push(group[0])
      continue
    }

    const complete = group.filter((i) => !cartItemNeedsCompletion(i))
    if (complete.length > 0) {
      const byId = new Map<string, OrderItem>()
      for (const item of complete) {
        const existing = byId.get(item.id)
        if (existing) existing.cantidad += item.cantidad
        else byId.set(item.id, { ...item })
      }
      consolidated.push(...byId.values())
      continue
    }

    let best = group[0]
    let maxQty = group[0].cantidad
    for (const item of group) {
      maxQty = Math.max(maxQty, item.cantidad)
      if (lineCompletionScore(item) > lineCompletionScore(best)) best = item
    }
    consolidated.push({ ...best, cantidad: maxQty })
  }

  return consolidated
}

export function mergeOrderItems(
  base: OrderItem[],
  incoming: OrderItem[],
  mode: "replace" | "append",
): OrderItem[] {
  if (mode === "replace") return consolidatePlatilloCartLines(incoming)

  let result = base.map((item) => ({ ...item }))

  for (const item of incoming) {
    const groupKey = platilloGroupKey(item)
    let qty = item.cantidad

    if (groupKey) {
      const priorIncomplete = result.filter(
        (i) => platilloGroupKey(i) === groupKey && cartItemNeedsCompletion(i),
      )
      const priorQty = priorIncomplete.reduce((sum, i) => sum + i.cantidad, 0)

      if (!cartItemNeedsCompletion(item)) {
        result = result.filter(
          (i) =>
            platilloGroupKey(i) !== groupKey || !cartItemNeedsCompletion(i),
        )
        if (priorQty > qty) qty = priorQty
      } else {
        const itemScore = lineCompletionScore(item)
        result = result.filter((i) => {
          if (platilloGroupKey(i) !== groupKey || !cartItemNeedsCompletion(i)) {
            return true
          }
          return lineCompletionScore(i) >= itemScore
        })
        if (priorQty > qty) qty = priorQty
      }
    }

    const existing = result.find((i) => i.id === item.id)
    if (existing) {
      existing.cantidad += qty
      if (item.notas && !existing.notas) existing.notas = item.notas
      if (lineCompletionScore(item) > lineCompletionScore(existing)) {
        Object.assign(existing, item, { cantidad: existing.cantidad })
      }
    } else {
      result.push({ ...item, cantidad: qty })
    }
  }

  return consolidatePlatilloCartLines(result)
}

/** Drop stale incomplete lines when a complete line exists for the same platillo/bebida. */
export function pruneSupersededIncompleteItems(items: OrderItem[]): OrderItem[] {
  const completePlatillos = new Set<string>()
  const completeBebidas = new Set<string>()

  for (const item of items) {
    if (
      item.needsProteina ||
      item.needsPlatilloTamano ||
      item.needsBebidaTamano ||
      item.needsBebidaEleccion
    ) {
      continue
    }
    const parsed = parseCartLineBaseId(item.id)
    if (parsed) {
      completePlatillos.add(`${parsed.categoriaId}:${parsed.platilloId}`)
    }
    if (item.bebidaId && !item.needsBebidaTamano) {
      completeBebidas.add(item.bebidaId)
    }
  }

  const pruned = items.filter((item) => {
    if (
      !item.needsProteina &&
      !item.needsPlatilloTamano &&
      !item.needsBebidaTamano &&
      !item.needsBebidaEleccion
    ) {
      return true
    }
    if (item.bebidaId && completeBebidas.has(item.bebidaId)) {
      return false
    }
    const parsed = parseCartLineBaseId(item.id)
    if (parsed && completePlatillos.has(`${parsed.categoriaId}:${parsed.platilloId}`)) {
      return false
    }
    return true
  })

  return consolidatePlatilloCartLines(pruned)
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
  needsPlatilloTamano: boolean
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
    needsPlatilloTamano: Boolean(i.needsPlatilloTamano),
    needsBebidaTamano: Boolean(i.needsBebidaTamano),
    needsBebidaEleccion: Boolean(i.needsBebidaEleccion),
    bebidaId: i.bebidaId,
  }))
}
