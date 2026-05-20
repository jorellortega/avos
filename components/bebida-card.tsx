"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/components/cart-provider"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import {
  bebidaTamanoLabels,
  getBebidaPrecioDefault,
  type BebidaMenu,
  type BebidaTamano,
} from "@/lib/menu-data"
import { BebidaThumb } from "@/components/bebida-thumb"
import { useBebidaImagenes } from "@/lib/use-bebida-imagenes"
import { cn } from "@/lib/utils"

type Props = {
  bebida: BebidaMenu
}

export function BebidaCard({ bebida }: Props) {
  const { addItem } = useCart()
  const { catalog } = useMenuCatalogContext()
  const bebidaImgs = useBebidaImagenes()
  const thumb = bebidaImgs[bebida.id]
  const [tamano, setTamano] = useState<BebidaTamano>("chico")
  const [showSuccess, setShowSuccess] = useState(false)

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
  }

  return (
    <Card
      className={`hover:shadow-md transition-shadow ${agotada ? "opacity-60" : ""}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <BebidaThumb src={thumb} alt={bebida.nombre} />
          <h4 className="font-medium text-foreground">{bebida.nombre}</h4>
        </div>
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
        <div className="flex items-center justify-between gap-2">
          {agotada ? (
            <p className="text-xs text-destructive font-medium">Agotado</p>
          ) : (
            <span className="text-sm text-muted-foreground">
              ${precio(tamano)} · {bebidaTamanoLabels[tamano]}
            </span>
          )}
          <Button
            size="sm"
            disabled={agotada}
            onClick={handleAddToCart}
            className={`shrink-0 transition-all ${showSuccess ? "bg-green-600 hover:bg-green-600" : ""}`}
          >
            {showSuccess ? "¡Listo!" : <Plus className="h-4 w-4" />}
            <span className="sr-only">Agregar {bebida.nombre}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
