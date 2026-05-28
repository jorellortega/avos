"use client"

import { useState } from "react"
import Image from "next/image"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCart } from "@/components/cart-provider"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import { MENU_COLLAGE_TILE_CLASS } from "@/components/menu-collage-tile"
import {
  bebidaTamanoLabels,
  getBebidaPrecioDefault,
  type BebidaTamano,
} from "@/lib/menu-data"
import type { BebidaCatalogEntry } from "@/lib/menu-catalog-shared"

type BebidaForCard = Pick<
  BebidaCatalogEntry,
  "id" | "nombre" | "precioChico" | "precioGrande"
>
import { BebidaThumb } from "@/components/bebida-thumb"
import { useBebidaImagenes } from "@/lib/use-bebida-imagenes"
import { cn } from "@/lib/utils"

type Props = {
  bebida: BebidaForCard
  collapsible?: boolean
}

export function BebidaCard({ bebida, collapsible = false }: Props) {
  const { addItem } = useCart()
  const { catalog } = useMenuCatalogContext()
  const bebidaImgs = useBebidaImagenes()
  const thumb = bebidaImgs[bebida.id]
  const [tamano, setTamano] = useState<BebidaTamano>("chico")
  const [showSuccess, setShowSuccess] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const oculta = catalog?.isBebidaHidden(bebida.id) ?? false
  const agotada = catalog?.isBebidaOut(bebida.id) ?? false

  const precio = (t: BebidaTamano) =>
    catalog?.getBebidaPrecio(bebida.id, t) ?? getBebidaPrecioDefault(bebida, t)

  if (oculta) return null

  const handleAddToCart = () => {
    if (agotada) return
    const label = bebidaTamanoLabels[tamano]
    addItem({
      id: `bebida-${bebida.id}-${tamano}-${Date.now()}`,
      nombre: `${bebida.nombre} (${label})`,
      categoria: "Bebidas",
      proteina: "",
      precio: precio(tamano),
      imagen: thumb ?? "",
    })

    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 1500)
    if (collapsible) setDialogOpen(false)
  }

  const orderForm = (
    <>
      <div className="flex gap-2">
        {(["chico", "grande"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={agotada}
            onClick={() => setTamano(t)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-2 text-center text-sm transition-colors",
              tamano === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/50",
              agotada && "pointer-events-none",
            )}
          >
            <span className="block font-medium">{bebidaTamanoLabels[t]}</span>
            <span className="block text-xs opacity-90">${precio(t)}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        {agotada ? (
          <p className="text-xs text-destructive font-medium">Agotado</p>
        ) : (
          <span className="text-sm text-muted-foreground">
            ${precio(tamano)} · {bebidaTamanoLabels[tamano]}
            {catalog?.bebidaTracksStock(bebida.id) ? (
              <span className="block text-xs text-amber-700 dark:text-amber-300">
                Quedan {catalog.getBebidaStockQty(bebida.id)}
              </span>
            ) : null}
          </span>
        )}
        <Button
          size="sm"
          disabled={agotada}
          onClick={handleAddToCart}
          className={cn(
            "shrink-0 transition-all",
            showSuccess && "bg-green-600 hover:bg-green-600",
          )}
        >
          {showSuccess ? "¡Listo!" : <Plus className="h-4 w-4" />}
          <span className="sr-only">Agregar {bebida.nombre}</span>
        </Button>
      </div>
    </>
  )

  if (collapsible) {
    if (agotada) {
      return (
        <div
          className={cn(MENU_COLLAGE_TILE_CLASS, "opacity-50 cursor-not-allowed")}
          aria-label={`${bebida.nombre}, agotado`}
        >
          {thumb ? (
            <Image
              src={thumb}
              alt=""
              fill
              className="object-cover grayscale"
              sizes="80px"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-xl">
              🥤
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[9px] font-medium text-white">
            Agotado
          </span>
        </div>
      )
    }

    return (
      <>
        <button
          type="button"
          className={MENU_COLLAGE_TILE_CLASS}
          onClick={() => setDialogOpen(true)}
          aria-label={`${bebida.nombre}, desde ${Math.min(precio("chico"), precio("grande"))} pesos`}
        >
          {thumb ? (
            <Image src={thumb} alt="" fill className="object-cover" sizes="80px" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-xl bg-muted">
              🥤
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-0.5 text-[8px] leading-tight text-white truncate">
            <span className="block uppercase opacity-75">Bebida</span>
            <span className="block font-medium truncate">{bebida.nombre}</span>
          </span>
        </button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{bebida.nombre}</DialogTitle>
            </DialogHeader>
            {orderForm}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Card className={cn("hover:shadow-md transition-shadow", agotada && "opacity-60")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <BebidaThumb src={thumb} alt={bebida.nombre} />
          <h4 className="font-medium text-foreground">{bebida.nombre}</h4>
        </div>
        {orderForm}
      </CardContent>
    </Card>
  )
}
