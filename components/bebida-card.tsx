"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/components/cart-provider"

interface BebidaCardProps {
  id: string
  nombre: string
  precio: number
}

export function BebidaCard({ id, nombre, precio }: BebidaCardProps) {
  const { addItem } = useCart()
  const [showSuccess, setShowSuccess] = useState(false)

  const handleAddToCart = () => {
    addItem({
      id: `bebida-${id}-${Date.now()}`,
      nombre,
      categoria: "Bebidas",
      proteina: "",
      precio,
      imagen: "",
    })

    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 1500)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-foreground">{nombre}</h4>
            <span className="text-primary font-semibold">${precio}</span>
          </div>
          <Button
            size="sm"
            onClick={handleAddToCart}
            className={`transition-all ${showSuccess ? "bg-green-600 hover:bg-green-600" : ""}`}
          >
            {showSuccess ? "¡Listo!" : <Plus className="h-4 w-4" />}
            <span className="sr-only">Agregar {nombre}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
