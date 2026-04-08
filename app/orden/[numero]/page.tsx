"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useOrders, OrderStatus, OrderItem } from "@/components/orders-provider"
import { categorias, bebidas, proteinas, getPrecioConProteina, Proteina } from "@/lib/menu-data"
import { 
  Clock, Check, ChefHat, Package, CreditCard, ArrowLeft, 
  Plus, Minus, Trash2, RefreshCw, Home
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

const statusSteps = [
  { status: "pendiente", label: "Recibido", icon: Package },
  { status: "preparando", label: "Preparando", icon: ChefHat },
  { status: "listo", label: "Listo", icon: Check },
]

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pendiente: { label: "Orden Recibida", color: "text-yellow-600" },
  preparando: { label: "En Preparación", color: "text-blue-600" },
  listo: { label: "Listo para Recoger", color: "text-green-600" },
  entregado: { label: "Entregado", color: "text-gray-600" },
  pagado: { label: "Pagado", color: "text-primary" },
}

export default function CustomerOrderPage({ params }: { params: Promise<{ numero: string }> }) {
  const resolvedParams = use(params)
  const orderNumber = parseInt(resolvedParams.numero)
  const { getOrderByNumber, updateOrder, orders } = useOrders()
  const [refreshKey, setRefreshKey] = useState(0)
  const [editItems, setEditItems] = useState<OrderItem[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta" | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 10000)
    return () => clearInterval(interval)
  }, [])

  const order = getOrderByNumber(orderNumber)

  useEffect(() => {
    if (order) {
      setEditItems(order.items)
    }
  }, [order?.id])

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Orden no encontrada
            </h2>
            <p className="text-muted-foreground mb-4">
              No pudimos encontrar la orden #{orderNumber}
            </p>
            <Link href="/">
              <Button className="gap-2">
                <Home className="h-4 w-4" />
                Ir al inicio
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentStepIndex = statusSteps.findIndex(s => s.status === order.status)
  const canEdit = order.status === "pendiente"
  const canPay = order.status !== "pagado"
  const config = statusConfig[order.status]

  const addItemToEdit = (categoria: typeof categorias[number], proteina: Proteina) => {
    const precio = getPrecioConProteina(categoria.precioBase, proteina)
    const itemId = `${categoria.id}-${proteina}`
    const existingItem = editItems.find(i => i.id === itemId)
    
    if (existingItem) {
      setEditItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, cantidad: item.cantidad + 1 } : item
      ))
    } else {
      setEditItems(prev => [...prev, {
        id: itemId,
        categoria: categoria.id,
        nombre: `${categoria.nombre} de ${proteina}`,
        proteina,
        cantidad: 1,
        precio
      }])
    }
  }

  const addBebidaToEdit = (bebida: typeof bebidas[number]) => {
    const existingItem = editItems.find(i => i.id === bebida.id)
    
    if (existingItem) {
      setEditItems(prev => prev.map(item => 
        item.id === bebida.id ? { ...item, cantidad: item.cantidad + 1 } : item
      ))
    } else {
      setEditItems(prev => [...prev, {
        id: bebida.id,
        categoria: "bebidas",
        nombre: bebida.nombre,
        cantidad: 1,
        precio: bebida.precio
      }])
    }
  }

  const updateEditQuantity = (itemId: string, delta: number) => {
    setEditItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = item.cantidad + delta
        return newQty > 0 ? { ...item, cantidad: newQty } : item
      }
      return item
    }).filter(item => item.cantidad > 0))
  }

  const removeEditItem = (itemId: string) => {
    setEditItems(prev => prev.filter(item => item.id !== itemId))
  }

  const saveChanges = () => {
    const newTotal = editItems.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
    updateOrder(order.id, { items: editItems, total: newTotal })
    setIsEditDialogOpen(false)
  }

  const handlePayment = () => {
    if (paymentMethod) {
      updateOrder(order.id, { status: "pagado" })
      setPaymentComplete(true)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png"
              alt="Avos"
              width={80}
              height={32}
              className="h-8 w-auto"
            />
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setRefreshKey(k => k + 1)}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Order Number */}
        <Card className="mb-6">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Tu número de orden</p>
            <h1 
              className="text-5xl font-bold text-primary mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              #{order.numero}
            </h1>
            <Badge className={`${config.color} bg-transparent border-current text-base px-4 py-1`}>
              {config.label}
            </Badge>
          </CardContent>
        </Card>

        {/* Status Progress */}
        {order.status !== "entregado" && order.status !== "pagado" && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                {statusSteps.map((step, index) => {
                  const Icon = step.icon
                  const isComplete = currentStepIndex >= index
                  const isCurrent = currentStepIndex === index
                  
                  return (
                    <div key={step.status} className="flex flex-col items-center flex-1">
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center mb-2
                        ${isComplete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                        ${isCurrent ? 'ring-4 ring-primary/20' : ''}
                      `}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className={`text-sm font-medium ${isComplete ? 'text-primary' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                      {index < statusSteps.length - 1 && (
                        <div className={`absolute h-1 w-1/4 top-1/2 ${isComplete ? 'bg-primary' : 'bg-muted'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>
              Tu Pedido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.cantidad}x {item.nombre}</p>
                    <p className="text-sm text-muted-foreground">${item.precio} c/u</p>
                  </div>
                  <span className="font-semibold">${(item.precio * item.cantidad).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          {/* Edit Order Dialog */}
          {canEdit && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2" size="lg">
                  <Plus className="h-4 w-4" />
                  Modificar Pedido
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: 'var(--font-heading)' }}>
                    Modificar Pedido
                  </DialogTitle>
                  <DialogDescription>
                    Agrega o quita productos de tu orden
                  </DialogDescription>
                </DialogHeader>

                {/* Current Items */}
                <div className="space-y-3 py-4">
                  <p className="font-medium text-sm">Productos actuales:</p>
                  {editItems.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Sin productos</p>
                  ) : (
                    editItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.nombre}</p>
                          <p className="text-xs text-muted-foreground">${item.precio}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateEditQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm">{item.cantidad}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateEditQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeEditItem(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Items */}
                <div className="space-y-4 border-t pt-4">
                  <p className="font-medium text-sm">Agregar productos:</p>
                  {categorias.map(cat => (
                    <div key={cat.id}>
                      <p className="text-sm font-medium mb-2">{cat.nombre}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {proteinas.map(prot => (
                          <Button
                            key={prot}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => addItemToEdit(cat, prot)}
                          >
                            {prot}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <p className="text-sm font-medium mb-2">Bebidas</p>
                    <div className="grid grid-cols-2 gap-2">
                      {bebidas.map(beb => (
                        <Button
                          key={beb.id}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => addBebidaToEdit(beb)}
                        >
                          {beb.nombre}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-4">
                  <div className="w-full space-y-2">
                    <div className="flex justify-between font-bold">
                      <span>Nuevo Total:</span>
                      <span>${editItems.reduce((sum, i) => sum + i.precio * i.cantidad, 0).toFixed(2)}</span>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={saveChanges}
                      disabled={editItems.length === 0}
                    >
                      Guardar Cambios
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Pay Dialog */}
          {canPay && (
            <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2" size="lg">
                  <CreditCard className="h-4 w-4" />
                  Pagar ${order.total.toFixed(2)}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: 'var(--font-heading)' }}>
                    {paymentComplete ? "Pago Completado" : "Método de Pago"}
                  </DialogTitle>
                </DialogHeader>

                {paymentComplete ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Gracias por tu pago</h3>
                    <p className="text-muted-foreground mb-4">
                      Tu orden #{order.numero} ha sido pagada
                    </p>
                    <Button onClick={() => setIsPayDialogOpen(false)}>
                      Cerrar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 py-4">
                      <Button
                        variant={paymentMethod === "tarjeta" ? "default" : "outline"}
                        className="w-full justify-start gap-3 h-auto py-4"
                        onClick={() => setPaymentMethod("tarjeta")}
                      >
                        <CreditCard className="h-5 w-5" />
                        <div className="text-left">
                          <p className="font-medium">Tarjeta</p>
                          <p className="text-sm text-muted-foreground">Débito o crédito</p>
                        </div>
                      </Button>
                      <Button
                        variant={paymentMethod === "efectivo" ? "default" : "outline"}
                        className="w-full justify-start gap-3 h-auto py-4"
                        onClick={() => setPaymentMethod("efectivo")}
                      >
                        <span className="text-lg">$</span>
                        <div className="text-left">
                          <p className="font-medium">Efectivo</p>
                          <p className="text-sm text-muted-foreground">Paga al recoger</p>
                        </div>
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button 
                        className="w-full" 
                        size="lg"
                        disabled={!paymentMethod}
                        onClick={handlePayment}
                      >
                        Confirmar Pago - ${order.total.toFixed(2)}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Info */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Esta página se actualiza automáticamente
        </p>
      </main>
    </div>
  )
}
