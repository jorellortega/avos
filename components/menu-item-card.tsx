"use client"

import { useState } from "react"
import Image from "next/image"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/components/cart-provider"
import {
  proteinas,
  type Proteina,
  getPrecioConProteina,
  imagenProteinaPorId,
} from "@/lib/menu-data"

interface MenuItemCardProps {
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
  categoria,
  nombre,
  descripcion,
  precioBase,
  tieneProteinas,
  imagen,
  proteinaImagenes,
}: MenuItemCardProps) {
  const { addItem } = useCart()
  const [selectedProteina, setSelectedProteina] = useState<Proteina>("Asada")
  const [cantidad, setCantidad] = useState(1)
  const [showSuccess, setShowSuccess] = useState(false)

  const precio = tieneProteinas 
    ? getPrecioConProteina(precioBase, selectedProteina) 
    : precioBase

  const handleAddToCart = () => {
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

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        <div className="p-5">
          <div className="flex items-start justify-between mb-2">
            <h3 
              className="text-xl font-semibold text-foreground"
              style={{ fontFamily: 'var(--font-heading)' }}
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
              <div className="grid grid-cols-2 gap-2">
                {proteinas.map((proteina) => (
                  <button
                    key={proteina}
                    type="button"
                    onClick={() => setSelectedProteina(proteina)}
                    className={`flex flex-col items-stretch gap-2 rounded-lg border p-2 text-left transition-all ${
                      selectedProteina === proteina
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
                      {proteina === "Camarón" && (
                        <span
                          className={`block text-xs opacity-80 ${
                            selectedProteina === proteina ? "" : "text-muted-foreground"
                          }`}
                        >
                          +$20
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
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
