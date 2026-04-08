"use client"

import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/components/cart-provider"
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft } from "lucide-react"

export default function CarritoPage() {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart()

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center py-16">
          <div className="text-center px-4">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="h-12 w-12 text-muted-foreground" />
            </div>
            <h1 
              className="text-2xl md:text-3xl font-bold text-foreground mb-3"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Tu carrito está vacío
            </h1>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              ¡Agrega algunos deliciosos platillos de nuestro menú para comenzar tu pedido!
            </p>
            <Link href="/menu">
              <Button size="lg">
                <ArrowLeft className="mr-2 h-5 w-5" />
                Ver Menú
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h1 
              className="text-2xl md:text-3xl font-bold text-foreground"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Tu Carrito
            </h1>
            <Button 
              variant="ghost" 
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={clearCart}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Vaciar carrito
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {item.nombre}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.categoria}
                        </p>
                        <p className="text-primary font-semibold mt-1">
                          ${item.precio} c/u
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                          >
                            <Minus className="h-4 w-4" />
                            <span className="sr-only">Disminuir cantidad</span>
                          </Button>
                          <span className="w-8 text-center font-medium">
                            {item.cantidad}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                          >
                            <Plus className="h-4 w-4" />
                            <span className="sr-only">Aumentar cantidad</span>
                          </Button>
                        </div>

                        <div className="text-right min-w-[70px]">
                          <p className="font-bold text-foreground">
                            ${item.precio * item.cantidad}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardContent className="p-6">
                  <h2 
                    className="text-xl font-bold text-foreground mb-4"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    Resumen del Pedido
                  </h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Artículos ({items.reduce((sum, item) => sum + item.cantidad, 0)})
                      </span>
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between">
                        <span className="font-semibold">Total</span>
                        <span className="font-bold text-xl text-primary">
                          ${total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link href="/checkout" className="block">
                    <Button className="w-full" size="lg">
                      Continuar al Pago
                    </Button>
                  </Link>

                  <Link href="/menu" className="block mt-3">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Seguir Comprando
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
