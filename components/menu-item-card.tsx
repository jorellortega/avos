"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/components/cart-provider"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import {
  proteinas,
  type Proteina,
  imagenProteinaPorId,
} from "@/lib/menu-data"

interface MenuItemCardProps {
  /** e.g. tacos, burritos — for pricing / availability */
  categoriaId: string
  /** Specific platillo id when category has multiple items (e.g. california-burrito) */
  platilloId?: string
  categoria: string
  nombre: string
  descripcion: string
  precioBase: number
  tieneProteinas: boolean
  imagen: string
  /** Optional overrides from DB (`/edit`); defaults in `imagenProteinaPorId` */
  proteinaImagenes?: Partial<Record<Proteina, string>>
}

export function MenuItemCard({
  categoriaId,
  platilloId,
  categoria,
  nombre,
  descripcion,
  precioBase,
  tieneProteinas,
  imagen,
  proteinaImagenes,
}: MenuItemCardProps) {
  const { addItem } = useCart()
  const { catalog } = useMenuCatalogContext()
  const [selectedProteina, setSelectedProteina] = useState<Proteina>("Asada")
  const [cantidad, setCantidad] = useState(1)
  const [showSuccess, setShowSuccess] = useState(false)

  const pid = platilloId ?? categoriaId
  const categoriaOculta = catalog?.isCategoriaHidden(categoriaId) ?? false
  const platilloOculto = catalog?.isPlatilloHidden(categoriaId, pid) ?? false
  const categoriaFuera = catalog?.isCategoriaOut(categoriaId) ?? false
  const platilloFuera = catalog?.isPlatilloOut(categoriaId, pid) ?? false

  const proteinasEnMenu = proteinas.filter(
    (p) => !catalog?.isProteinaHidden(categoriaId, p, pid),
  )

  const proteinasDisponibles = proteinasEnMenu.filter(
    (p) => !catalog?.isProteinaOut(categoriaId, p, pid),
  )

  useEffect(() => {
    if (!catalog || !tieneProteinas) return
    const enMenu = proteinas.filter(
      (p) => !catalog.isProteinaHidden(categoriaId, p, pid),
    )
    const pickable = enMenu.filter(
      (p) => !catalog.isProteinaOut(categoriaId, p, pid),
    )
    if (pickable.length === 0) return
    if (
      catalog.isProteinaHidden(categoriaId, selectedProteina, pid) ||
      catalog.isProteinaOut(categoriaId, selectedProteina, pid)
    ) {
      setSelectedProteina(pickable[0])
    }
  }, [catalog, tieneProteinas, selectedProteina, categoriaId, pid])

  if (categoriaOculta || platilloOculto) return null

  const precio = tieneProteinas
    ? catalog?.getPrecioConProteina(categoriaId, selectedProteina, pid) ??
      (selectedProteina === "Camarón" ? precioBase + 20 : precioBase)
    : catalog?.getPlatilloPrecio(categoriaId, pid) ?? precioBase

  const precioProteina = (p: Proteina) =>
    catalog?.getPrecioConProteina(categoriaId, p, pid) ??
    (p === "Camarón" ? precioBase + 20 : precioBase)

  const handleAddToCart = () => {
    if (categoriaFuera || platilloFuera) return
    if (tieneProteinas && proteinasDisponibles.length === 0) return
    if (
      tieneProteinas &&
      catalog?.isProteinaOut(categoriaId, selectedProteina, pid)
    )
      return

    const itemId = tieneProteinas
      ? `${categoria}-${selectedProteina}-${Date.now()}`
      : `${categoria}-${Date.now()}`

    for (let i = 0; i < cantidad; i++) {
      addItem({
        id: `${itemId}-${i}`,
        nombre: tieneProteinas ? `${nombre} de ${selectedProteina}` : nombre,
        categoria,
        proteina: tieneProteinas ? selectedProteina : "",
        precio,
        imagen,
      })
    }

    setShowSuccess(true)
    setCantidad(1)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  if (categoriaFuera || platilloFuera) {
    return (
      <Card className="overflow-hidden border-destructive/30 bg-muted/40">
        <CardContent className="p-5">
          <h3
            className="text-xl font-semibold text-foreground mb-1"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {nombre}
          </h3>
          <p className="text-sm font-medium text-destructive">
            No disponible por el momento.
          </p>
          <p className="text-sm text-muted-foreground mt-2">{descripcion}</p>
        </CardContent>
      </Card>
    )
  }

  const sinProteinas = tieneProteinas && proteinasDisponibles.length === 0

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        <div className="p-5">
          <div className="flex items-start justify-between mb-2">
            <h3
              className="text-xl font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {nombre}
            </h3>
            <span className="text-lg font-bold text-primary">
              ${precio}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {descripcion}
          </p>

          {tieneProteinas && (
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Elige tu proteína:
              </label>
              {sinProteinas ? (
                <p className="text-sm text-destructive font-medium">
                  Todas las proteínas están agotadas hoy.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {proteinasEnMenu.map((proteina) => {
                    const agotada =
                      catalog?.isProteinaOut(categoriaId, proteina, pid) ??
                      false
                    const isSel = selectedProteina === proteina
                    return (
                      <button
                        key={proteina}
                        type="button"
                        disabled={agotada}
                        onClick={() => !agotada && setSelectedProteina(proteina)}
                        className={`flex flex-col items-stretch gap-2 rounded-lg border p-2 text-left transition-all ${
                          agotada
                            ? "opacity-40 cursor-not-allowed border-border bg-muted"
                            : isSel
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
                          <Image
                            src={
                              proteinaImagenes?.[proteina] ??
                              imagenProteinaPorId[proteina]
                            }
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 45vw, 200px"
                          />
                        </span>
                        <span className="px-0.5 text-center text-sm font-medium leading-tight">
                          {proteina}
                          {agotada && (
                            <span className="block text-xs">Agotado</span>
                          )}
                          {!agotada && (
                            <span
                              className={`block text-xs opacity-80 ${
                                isSel ? "" : "text-muted-foreground"
                              }`}
                            >
                              ${precioProteina(proteina)}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCantidad(Math.max(1, cantidad - 1))}
              >
                <Minus className="h-4 w-4" />
                <span className="sr-only">Disminuir cantidad</span>
              </Button>
              <span className="w-8 text-center font-medium">{cantidad}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCantidad(cantidad + 1)}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Aumentar cantidad</span>
              </Button>
            </div>
            <Button
              onClick={handleAddToCart}
              disabled={sinProteinas}
              className={`flex-1 transition-all ${showSuccess ? "bg-green-600 hover:bg-green-600" : ""}`}
            >
              {showSuccess ? "¡Agregado!" : "Agregar"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
