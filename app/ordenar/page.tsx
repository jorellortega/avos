"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  ShoppingCart,
  Utensils,
  ShoppingBag,
  Trash2
} from "lucide-react"
import {
  menuCategories,
  bebidasOrdenar,
  type OrdenarMenuItem,
  type BebidaOrdenar,
  type Proteina,
} from "@/lib/menu-data"
import { useOrders, type OrderItem } from "@/components/orders-provider"

interface CartItem {
  id: string
  name: string
  categoria: string
  protein?: string
  price: number
  quantity: number
}

export default function OrdenarPage() {
  const router = useRouter()
  const { addOrder } = useOrders()
  const [orderType, setOrderType] = useState<"dine-in" | "takeout" | null>(null)
  const [tableNumber, setTableNumber] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState("tacos")

  useEffect(() => {
    // Get order info from sessionStorage
    const type = sessionStorage.getItem("orderType") as "dine-in" | "takeout" | null
    const table = sessionStorage.getItem("tableNumber") || ""
    const name = sessionStorage.getItem("customerName") || ""
    const phone = sessionStorage.getItem("customerPhone") || ""

    if (!type) {
      router.push("/")
      return
    }

    setOrderType(type)
    setTableNumber(table)
    setCustomerName(name)
    setCustomerPhone(phone)
  }, [router])

  const addToCart = (item: OrdenarMenuItem, categoria: string, protein?: Proteina) => {
    const itemId = `${item.name}-${protein || "none"}`
    const existingItem = cart.find(i => i.id === itemId)
    
    let price = item.basePrice
    if (protein === "Camarón" && item.shrimpExtra) {
      price += item.shrimpExtra
    }

    if (existingItem) {
      setCart(cart.map(i => 
        i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setCart([...cart, {
        id: itemId,
        name: item.name,
        categoria,
        protein,
        price,
        quantity: 1
      }])
    }
  }

  const addBebidaToCart = (bebida: BebidaOrdenar) => {
    const itemId = `bebida-${bebida.name}`
    const existingItem = cart.find(i => i.id === itemId)

    if (existingItem) {
      setCart(cart.map(i => 
        i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setCart([...cart, {
        id: itemId,
        name: bebida.name,
        categoria: "Bebidas",
        price: bebida.price,
        quantity: 1
      }])
    }
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + delta
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const removeItem = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId))
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const handlePlaceOrder = () => {
    if (cart.length === 0) return

    const orderItems: OrderItem[] = cart.map((item) => ({
      id: `${item.id}-line`,
      categoria: item.categoria,
      nombre: item.protein ? `${item.name} de ${item.protein}` : item.name,
      proteina: item.protein,
      cantidad: item.quantity,
      precio: item.price,
    }))

    const orderNumber = addOrder({
      items: orderItems,
      nombreCliente: customerName || undefined,
      mesa: orderType === "dine-in" ? tableNumber : undefined,
      tipo: orderType === "dine-in" ? "mesa" : "pickup",
      status: "pendiente",
      total,
    })

    // Clear session storage
    sessionStorage.removeItem("orderType")
    sessionStorage.removeItem("tableNumber")
    sessionStorage.removeItem("customerName")
    sessionStorage.removeItem("customerPhone")

    // Redirect to order status page
    router.push(`/orden/${orderNumber}`)
  }

  if (!orderType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Header Info */}
        <div className="flex items-center justify-between mb-6">
          <Link 
            href={orderType === "dine-in" ? "/comer-aqui" : "/para-llevar"}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>

          <div className="flex items-center gap-2">
            {orderType === "dine-in" ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Utensils className="h-3 w-3" />
                Mesa {tableNumber}
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                Para Llevar
              </Badge>
            )}
            {customerName && (
              <Badge variant="outline">{customerName}</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu */}
          <div className="lg:col-span-2">
            <h1 
              className="text-2xl font-bold mb-4"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Menú
            </h1>

            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
                {menuCategories.map((category) => (
                  <TabsTrigger 
                    key={category.id} 
                    value={category.id}
                    className="text-sm"
                  >
                    {category.name}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="bebidas" className="text-sm">
                  Bebidas
                </TabsTrigger>
              </TabsList>

              {menuCategories.map((category) => (
                <TabsContent key={category.id} value={category.id}>
                  <div className="space-y-4">
                    <div className="bg-secondary/30 rounded-lg p-4 mb-4">
                      <h3 className="font-semibold mb-1">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>

                    {category.items.map((item) => (
                      <Card key={item.name} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-semibold">{item.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                ${item.basePrice} MXN
                                {item.shrimpExtra && (
                                  <span className="text-xs ml-2">
                                    (Camarón +${item.shrimpExtra})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            {item.proteins.map((protein) => (
                              <Button
                                key={protein}
                                size="sm"
                                variant="outline"
                                onClick={() => addToCart(item, category.name, protein)}
                                className="text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                {protein}
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              ))}

              <TabsContent value="bebidas">
                <div className="space-y-4">
                  <div className="bg-secondary/30 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold mb-1">Aguas Frescas</h3>
                    <p className="text-sm text-muted-foreground">Bebidas naturales y refrescantes</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {bebidasOrdenar.map((bebida) => (
                      <Card key={bebida.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold">{bebida.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                ${bebida.price} MXN
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addBebidaToCart(bebida)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Tu Orden</h2>
                    {itemCount > 0 && (
                      <Badge className="ml-auto">{itemCount}</Badge>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">
                      Tu carrito está vacío
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {cart.map((item) => (
                          <div 
                            key={item.id} 
                            className="flex items-center justify-between py-2 border-b border-border last:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {item.protein ? `${item.name} de ${item.protein}` : item.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ${item.price} c/u
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm">{item.quantity}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-border mt-4 pt-4">
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-semibold">Total</span>
                          <span className="text-xl font-bold text-primary">
                            ${total.toFixed(2)} MXN
                          </span>
                        </div>

                        <Button 
                          className="w-full" 
                          size="lg"
                          onClick={handlePlaceOrder}
                        >
                          Hacer Pedido
                        </Button>
                      </div>
                    </>
                  )}
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
