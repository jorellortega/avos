"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCart } from "@/components/cart-provider"
import { OrderItemExtrasPicker } from "@/components/order-item-extras-picker"
import { MENU_COLLAGE_TILE_CLASS } from "@/components/menu-collage-tile"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import { useCustomizationConfig } from "@/components/order-customizations-provider"
import { defaultOrderExtras } from "@/lib/order-item-customizations"
import { cartLineKey, formatOrderItemNotas } from "@/lib/order-item-extras"
import { cn } from "@/lib/utils"
import {
  proteinas,
  bebidaTamanoLabels,
  getPlatilloPrecioDefault,
  getPlatilloPrecioProteinaTamanoDefault,
  getPlatilloTamanoLabel,
  getProteinasForPlatillo,
  resolveMenuImageUrl,
  resolveProteinaImagen,
  type BebidaTamano,
  type Proteina,
  type ProteinaPlatillo,
} from "@/lib/menu-data"
import {
  platilloCartSuffix,
  platilloLineNombre,
  platilloProteinaDisplayNombre,
  proteinaDisplayLabel,
  type PlatilloPickerFlags,
} from "@/lib/platillo-config"

interface MenuItemCardProps {
  categoriaId: string
  platilloId?: string
  categoria: string
  nombre: string
  descripcion: string
  precioBase: number
  tieneProteinas: boolean
  tieneTamanos?: boolean
  precioChico?: number
  precioGrande?: number
  tamanoLabelChico?: string
  tamanoLabelGrande?: string
  preciosProteinaTamano?: import("@/lib/menu-data").ProteinaTamanoPrecios
  proteinasPlatillo?: readonly Proteina[]
  opciones?: readonly { id: string; label: string }[]
  imagen: string
  proteinaImagenes?: Partial<Record<Proteina, string>>
  collapsible?: boolean
  categoryBadge?: string
  /** One card per protein on category pages (/menu/tacos, etc.). */
  presetProteina?: ProteinaPlatillo
  tileImagen?: string
}

export function MenuItemCard({
  categoriaId,
  platilloId,
  categoria,
  nombre,
  descripcion,
  precioBase,
  tieneProteinas,
  tieneTamanos = false,
  precioChico,
  precioGrande,
  tamanoLabelChico,
  tamanoLabelGrande,
  preciosProteinaTamano,
  proteinasPlatillo,
  opciones,
  imagen,
  proteinaImagenes,
  collapsible = false,
  categoryBadge,
  presetProteina,
  tileImagen,
}: MenuItemCardProps) {
  const { addItem } = useCart()
  const { catalog } = useMenuCatalogContext()
  const customizationConfig = useCustomizationConfig(categoriaId, platilloId)
  const [selectedProteina, setSelectedProteina] = useState<ProteinaPlatillo>(
    presetProteina ?? "Asada",
  )
  const [cantidad, setCantidad] = useState(1)
  const [extras, setExtras] = useState<string[]>(() =>
    defaultOrderExtras(customizationConfig),
  )
  const [customNote, setCustomNote] = useState("")
  const [selectedTamano, setSelectedTamano] = useState<BebidaTamano>("chico")
  const [selectedOpcion, setSelectedOpcion] = useState<string>(
    opciones?.[0]?.id ?? "",
  )
  const [showSuccess, setShowSuccess] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const pid = platilloId ?? categoriaId
  const categoriaOculta = catalog?.isCategoriaHidden(categoriaId) ?? false
  const platilloOculto = catalog?.isPlatilloHidden(categoriaId, pid) ?? false
  const categoriaFuera = catalog?.isCategoriaOut(categoriaId) ?? false
  const platilloFuera = catalog?.isPlatilloOut(categoriaId, pid) ?? false

  const proteinasLista = proteinasPlatillo?.length
    ? proteinasPlatillo
    : proteinas

  const proteinasEnMenu = proteinasLista.filter(
    (p) => !catalog?.isProteinaHidden(categoriaId, p, pid),
  )

  const proteinasDisponibles = proteinasEnMenu.filter(
    (p) => !catalog?.isProteinaOut(categoriaId, p, pid),
  )

  const lockProteina = Boolean(presetProteina)

  useEffect(() => {
    if (!catalog || !tieneProteinas || lockProteina) return
    const pickable = proteinasEnMenu.filter(
      (p) => !catalog.isProteinaOut(categoriaId, p, pid),
    )
    if (pickable.length === 0) return
    if (
      catalog.isProteinaHidden(categoriaId, selectedProteina, pid) ||
      catalog.isProteinaOut(categoriaId, selectedProteina, pid)
    ) {
      setSelectedProteina(pickable[0])
    }
  }, [
    catalog,
    tieneProteinas,
    lockProteina,
    selectedProteina,
    categoriaId,
    pid,
    proteinasEnMenu,
  ])

  if (categoriaOculta || platilloOculto) return null

  const flags: PlatilloPickerFlags = {
    tieneProteinas,
    tieneTamanos,
    tieneOpciones: (opciones?.length ?? 0) > 0,
  }
  const platilloMeta = {
    tamanoLabelChico,
    tamanoLabelGrande,
    opciones,
  }

  const precio = tieneProteinas
    ? catalog?.getPrecioConProteina(
        categoriaId,
        selectedProteina,
        pid,
        tieneTamanos ? selectedTamano : undefined,
      ) ??
      (() => {
        if (tieneTamanos) {
          return getPlatilloPrecioProteinaTamanoDefault(
            {
              preciosProteinaTamano,
              precioBase,
              precioChico,
              precioGrande,
              tieneTamanos: true,
            },
            selectedProteina,
            selectedTamano,
          )
        }
        return selectedProteina === "Camarón" ? precioBase + 20 : precioBase
      })()
    : tieneTamanos
      ? catalog?.getPlatilloPrecioTamano(categoriaId, pid, selectedTamano) ??
        (selectedTamano === "chico"
          ? (precioChico ?? precioBase)
          : (precioGrande ?? precioBase))
      : catalog?.getPlatilloPrecio(categoriaId, pid) ?? precioBase

  const precioProteina = (p: Proteina) =>
    catalog?.getPrecioConProteina(
      categoriaId,
      p,
      pid,
      tieneTamanos ? selectedTamano : undefined,
    ) ??
    (() => {
      if (tieneTamanos) {
        return getPlatilloPrecioProteinaTamanoDefault(
          {
            preciosProteinaTamano,
            precioBase,
            precioChico,
            precioGrande,
            tieneTamanos: true,
          },
          p,
          selectedTamano,
        )
      }
      return p === "Camarón" ? precioBase + 20 : precioBase
    })()

  const sinProteinas = tieneProteinas && proteinasDisponibles.length === 0
  const presetProteinaAgotada =
    lockProteina &&
    tieneProteinas &&
    (catalog?.isProteinaOut(categoriaId, selectedProteina, pid) ?? false)

  const displayNombre = presetProteina
    ? platilloProteinaDisplayNombre(nombre, presetProteina, categoriaId)
    : nombre

  const desdePrecio = tieneProteinas
    ? proteinasDisponibles.length > 0
      ? Math.min(...proteinasDisponibles.map((p) => precioProteina(p)))
      : precioBase
    : tieneTamanos
      ? Math.min(
          catalog?.getPlatilloPrecioTamano(categoriaId, pid, "chico") ??
            (precioChico ?? precioBase),
          catalog?.getPlatilloPrecioTamano(categoriaId, pid, "grande") ??
            (precioGrande ?? precioBase),
        )
      : precio

  const thumbSrc = presetProteina
    ? resolveProteinaImagen(presetProteina, proteinaImagenes, imagen)
    : resolveMenuImageUrl(tileImagen, imagen)
  const tilePrice = desdePrecio

  const handleAddToCart = () => {
    if (categoriaFuera || platilloFuera) return
    if (tieneProteinas && proteinasDisponibles.length === 0) return
    if (
      tieneProteinas &&
      catalog?.isProteinaOut(categoriaId, selectedProteina, pid)
    )
      return

    const tam = tieneTamanos ? selectedTamano : undefined
    const opcionId = flags.tieneOpciones ? selectedOpcion : undefined
    const baseId = `${categoriaId}-${pid}-${platilloCartSuffix(flags, tam, tieneProteinas ? selectedProteina : undefined, opcionId)}`
    const itemId = cartLineKey(baseId, extras, customNote, customizationConfig)
    const notas = formatOrderItemNotas(extras, customNote, customizationConfig)
    const displayNombre = platilloLineNombre(
      nombre,
      flags,
      tam,
      tieneProteinas ? selectedProteina : undefined,
      platilloMeta,
      opcionId,
      categoriaId,
    )

    for (let i = 0; i < cantidad; i++) {
      addItem({
        id: itemId,
        nombre: displayNombre,
        categoria,
        proteina: tieneProteinas ? selectedProteina : "",
        precio,
        imagen: thumbSrc,
        notas,
      })
    }

    setShowSuccess(true)
    setCantidad(1)
    setExtras(defaultOrderExtras(customizationConfig))
    setCustomNote("")
    setTimeout(() => setShowSuccess(false), 2000)
    if (collapsible) setDialogOpen(false)
  }

  const orderForm = (
    <div className="space-y-4">
      {tieneTamanos ? (
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Tamaño:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["chico", "grande"] as const).map((tam) => {
              const p =
                catalog?.getPlatilloPrecioTamano(categoriaId, pid, tam) ??
                (tam === "chico"
                  ? (precioChico ?? precioBase)
                  : (precioGrande ?? precioBase))
              const isSel = selectedTamano === tam
              return (
                <button
                  key={tam}
                  type="button"
                  onClick={() => setSelectedTamano(tam)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    isSel
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/50",
                  )}
                >
                  {getPlatilloTamanoLabel(
                    { tamanoLabelChico, tamanoLabelGrande },
                    tam,
                  )}
                  <span className="block text-xs opacity-80">${p}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {tieneProteinas && !lockProteina ? (
        <div>
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
                  catalog?.isProteinaOut(categoriaId, proteina, pid) ?? false
                const isSel = selectedProteina === proteina
                return (
                  <button
                    key={proteina}
                    type="button"
                    disabled={agotada}
                    onClick={() => !agotada && setSelectedProteina(proteina)}
                    className={cn(
                      "flex flex-col items-stretch gap-2 rounded-lg border p-2 text-left transition-all",
                      agotada
                        ? "opacity-40 cursor-not-allowed border-border bg-muted"
                        : isSel
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:border-primary/50",
                    )}
                  >
                    <span className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
                      <Image
                        src={resolveProteinaImagen(
                          proteina,
                          proteinaImagenes,
                          imagen,
                        )}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    </span>
                    <span className="px-0.5 text-center text-sm font-medium leading-tight">
                      {proteinaDisplayLabel(proteina, categoriaId)}
                      {agotada ? (
                        <span className="block text-xs">Agotado</span>
                      ) : (
                        <span
                          className={cn(
                            "block text-xs opacity-80",
                            !isSel && "text-muted-foreground",
                          )}
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
      ) : null}

      {flags.tieneOpciones && opciones?.length ? (
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Elige 1 fruta:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {opciones.map((opcion) => {
              const isSel = selectedOpcion === opcion.id
              return (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => setSelectedOpcion(opcion.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    isSel
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/50",
                  )}
                >
                  {opcion.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <OrderItemExtrasPicker
        config={customizationConfig}
        extras={extras}
        customNote={customNote}
        onExtrasChange={setExtras}
        onCustomNoteChange={setCustomNote}
        compact
      />

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
          disabled={sinProteinas || presetProteinaAgotada}
          className={cn(
            "flex-1 transition-all",
            showSuccess && "bg-green-600 hover:bg-green-600",
          )}
        >
          {showSuccess ? "¡Agregado!" : "Agregar"}
        </Button>
      </div>
    </div>
  )

  if (categoriaFuera || platilloFuera) {
    if (collapsible) {
      return (
        <div
          className={cn(
            MENU_COLLAGE_TILE_CLASS,
            "opacity-50 cursor-not-allowed",
          )}
          aria-label={`${nombre}, agotado`}
        >
          <Image
            src={thumbSrc}
            alt=""
            fill
            className="object-cover grayscale"
            sizes="80px"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[9px] font-medium text-white px-0.5 text-center">
            Agotado
          </span>
        </div>
      )
    }
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

  if (collapsible) {
    return (
      <>
        <button
          type="button"
          className={MENU_COLLAGE_TILE_CLASS}
          onClick={() => setDialogOpen(true)}
          aria-label={`${categoryBadge ? `${categoryBadge}, ` : ""}${nombre}, desde $${tilePrice}`}
        >
          <Image
            src={thumbSrc}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 33vw, 160px"
          />
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-0.5 text-[8px] leading-tight text-white truncate">
            {categoryBadge ? (
              <span className="block uppercase opacity-75">{categoryBadge}</span>
            ) : null}
            <span className="block font-medium truncate">{nombre}</span>
          </span>
        </button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md max-h-[min(90vh,640px)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>
                {displayNombre}
              </DialogTitle>
              <DialogDescription>{descripcion}</DialogDescription>
              <p className="text-lg font-bold text-primary pt-1">${precio}</p>
            </DialogHeader>
            {orderForm}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        <div className="relative aspect-square w-full bg-muted">
          <Image
            src={thumbSrc}
            alt={displayNombre}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between mb-2 gap-3">
            <h3
              className="text-xl font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {displayNombre}
            </h3>
            <span className="text-lg font-bold text-primary shrink-0">
              ${precio}
            </span>
          </div>
          {presetProteinaAgotada ? (
            <p className="text-sm font-medium text-destructive mb-2">
              Agotado hoy
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {descripcion}
          </p>
          {orderForm}
        </div>
      </CardContent>
    </Card>
  )
}
