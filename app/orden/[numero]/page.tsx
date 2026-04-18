"use client"

import { useEffect, useState, use, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useOrders, OrderStatus, OrderItem } from "@/components/orders-provider"
import { recordCustomerPaymentIntentToSupabase } from "@/lib/avos-orders-sync"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import {
  BEBIDAS_CATEGORIA_ID,
  categorias,
  bebidas,
  proteinas,
  type Proteina,
} from "@/lib/menu-data"
import { precioItemConProteina } from "@/lib/menu-catalog-shared"
import { useProteinaImagenes } from "@/lib/use-proteina-imagenes"
import {
  Check,
  ChefHat,
  Package,
  CreditCard,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Home,
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

/** Paso 1 = pago pendiente; la cocina sigue en pasos 2–3 */
const statusSteps = [
  { status: "pendiente", label: "Esperando pago", icon: CreditCard },
  { status: "preparando", label: "Preparando", icon: ChefHat },
  { status: "listo", label: "Listo", icon: Check },
]

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pendiente: { label: "Pendiente de pago", color: "text-amber-600" },
  preparando: { label: "En Preparación", color: "text-blue-600" },
  listo: { label: "Listo para Recoger", color: "text-green-600" },
  entregado: { label: "Entregado", color: "text-gray-600" },
  pagado: { label: "Pago recibido", color: "text-primary" },
}

/** After online payment: pago → cocina → listo (synced desde Supabase). */
function PaidKitchenTrack({ status }: { status: string }) {
  const s = status
  const stepPayDone = true
  const stepPrepDone = ["preparando", "listo", "entregado"].includes(s)
  const stepReadyDone = ["listo", "entregado"].includes(s)
  const prepCurrent = s === "pagado" || s === "preparando"
  const readyCurrent = s === "listo"

  const ring = "ring-4 ring-primary/20"
  const steps = [
    {
      label: "Pago",
      sub: "Recibido",
      done: stepPayDone,
      current: false,
      Icon: Check,
    },
    {
      label: "Preparando",
      sub: s === "pagado" ? "En cola" : "",
      done: stepPrepDone,
      current: prepCurrent,
      Icon: ChefHat,
    },
    {
      label: "Listo",
      sub: "Para recoger",
      done: stepReadyDone,
      current: readyCurrent,
      Icon: Check,
    },
  ]

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground text-center mb-4">Seguimiento del pedido</p>
        <div className="flex items-start justify-between gap-1">
          {steps.map((step) => {
            const Icon = step.Icon
            const isComplete = step.done
            const isCurrent = step.current
            return (
              <div key={step.label} className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={`
                    w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2
                    ${isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                    ${isCurrent ? ring : ""}
                  `}
                >
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <span
                  className={`text-[11px] sm:text-xs font-medium text-center leading-tight px-0.5 ${
                    isComplete || isCurrent ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
                {step.sub ? (
                  <span className="text-[10px] text-muted-foreground text-center mt-0.5">{step.sub}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function CustomerOrderPage({ params }: { params: Promise<{ numero: string }> }) {
  const resolvedParams = use(params)
  const orderNumber = parseInt(resolvedParams.numero)
  const { getOrderByNumber, updateOrder } = useOrders()
  const [refreshKey, setRefreshKey] = useState(0)
  const [editItems, setEditItems] = useState<OrderItem[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta" | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [dbPaymentMethod, setDbPaymentMethod] = useState<string | null>(null)
  const [dbPaidAt, setDbPaidAt] = useState<string | null>(null)
  /** Kitchen workflow from Supabase (preparando, listo, …) — may differ from local until poll. */
  const [dbOrderStatus, setDbOrderStatus] = useState<string | null>(null)
  const [intentSubmittedLocal, setIntentSubmittedLocal] = useState(false)
  const [payOnlineLoading, setPayOnlineLoading] = useState(false)
  const [payOnlineError, setPayOnlineError] = useState("")
  const syncedPagadoRef = useRef(false)
  const proteinaImgs = useProteinaImagenes()
  const { catalog } = useMenuCatalogContext()

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

  useEffect(() => {
    syncedPagadoRef.current = false
  }, [order?.id])

  useEffect(() => {
    if (!order?.id) return

    const load = async () => {
      const supabase = createBrowserSupabase()
      const { data, error } = await supabase.rpc("get_avos_order_public_snapshot", {
        p_id: order.id,
      })
      if (error) return

      const snap = data as {
        paid_at?: string | null
        payment_method?: string | null
        status?: string | null
      } | null

      if (!snap) return

      setDbPaymentMethod(snap.payment_method ?? null)
      setDbPaidAt(snap.paid_at ?? null)
      const remoteStatus = snap.status?.trim() ?? null
      setDbOrderStatus(remoteStatus)

      if (snap.paid_at && !syncedPagadoRef.current) {
        syncedPagadoRef.current = true
        updateOrder(order.id, { status: "pagado" })
      }

      if (
        remoteStatus &&
        ["preparando", "listo", "entregado"].includes(remoteStatus) &&
        order.status !== remoteStatus
      ) {
        updateOrder(order.id, { status: remoteStatus as OrderStatus })
      }
    }

    void load()
    const interval = setInterval(() => void load(), 5000)
    return () => clearInterval(interval)
  }, [order?.id, order?.numero, order?.status, updateOrder])

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
  const hasPaymentIntent =
    Boolean(dbPaymentMethod) || intentSubmittedLocal
  const isPaid =
    order.status === "pagado" || Boolean(dbPaidAt)
  const canPay =
    order.status !== "pagado" && !hasPaymentIntent

  const workflow = (dbOrderStatus ?? order.status) as OrderStatus

  const badgeConfig = (() => {
    if (isPaid) {
      if (workflow === "preparando") return statusConfig.preparando
      if (workflow === "listo") return statusConfig.listo
      if (workflow === "entregado") return statusConfig.entregado
      if (workflow === "pagado") {
        return {
          label: "Pago recibido — esperando cocina",
          color: "text-primary",
        }
      }
      return statusConfig.pagado
    }
    if (hasPaymentIntent) {
      return {
        label: "Pendiente de confirmación en caja",
        color: "text-amber-600",
      }
    }
    return statusConfig.pendiente
  })()

  const isPickup = order.tipo === "pickup"

  const addItemToEdit = (categoria: typeof categorias[number], proteina: Proteina) => {
    const base =
      catalog?.getCategoriaPrecioBase(categoria.id) ?? categoria.precioBase
    const extra = catalog?.getCamarónExtra() ?? 20
    const precio = precioItemConProteina(base, proteina, extra)
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
    const precioUnit = catalog?.getBebidaPrecio(bebida.id) ?? bebida.precio
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
        precio: precioUnit
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
    const method: "efectivo" | "tarjeta" = isPickup
      ? "tarjeta"
      : paymentMethod!
    if (!isPickup && !paymentMethod) return
    void recordCustomerPaymentIntentToSupabase(order.id, method).then((ok) => {
      if (ok) setIntentSubmittedLocal(true)
    })
    setPaymentComplete(true)
  }

  const handlePayOnline = () => {
    setPayOnlineError("")
    setPayOnlineLoading(true)
    void (async () => {
      try {
        const res = await fetch("/api/checkout/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        })
        const data = (await res.json()) as { url?: string; error?: string }
        if (!res.ok || !data.url) {
          setPayOnlineError(data.error ?? "No se pudo iniciar el pago.")
          setPayOnlineLoading(false)
          return
        }
        window.location.href = data.url
      } catch {
        setPayOnlineError("Error de red. Intenta de nuevo.")
        setPayOnlineLoading(false)
      }
    })()
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
            <Badge
              className={`${badgeConfig.color} bg-transparent border-current text-base px-4 py-1`}
            >
              {badgeConfig.label}
            </Badge>
          </CardContent>
        </Card>

        {/* Status: sin pago aún → pasos clásicos; ya pagó → cocina desde Supabase */}
        {isPaid && workflow !== "entregado" && (
          <PaidKitchenTrack status={workflow} />
        )}
        {!isPaid && order.status !== "entregado" && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                {statusSteps.map((step, index) => {
                  const Icon = step.icon
                  const isComplete = currentStepIndex >= index
                  const isCurrent = currentStepIndex === index

                  return (
                    <div key={step.status} className="flex flex-col items-center flex-1">
                      <div
                        className={`
                        w-12 h-12 rounded-full flex items-center justify-center mb-2
                        ${isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                        ${isCurrent ? "ring-4 ring-primary/20" : ""}
                      `}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <span
                        className={`text-sm font-medium ${isComplete ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {step.label}
                      </span>
                      {index < statusSteps.length - 1 && (
                        <div
                          className={`absolute h-1 w-1/4 top-1/2 ${isComplete ? "bg-primary" : "bg-muted"}`}
                        />
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
                  {categorias
                    .filter((cat) => !catalog?.isCategoriaOut(cat.id))
                    .map(cat => (
                    <div key={cat.id}>
                      <p className="text-sm font-medium mb-2">{cat.nombre}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {proteinas.map((prot) => {
                          const agotada = catalog?.isProteinaOut(prot) ?? false
                          return (
                          <button
                            key={prot}
                            type="button"
                            disabled={agotada}
                            onClick={() => {
                              if (agotada) return
                              addItemToEdit(cat, prot)
                            }}
                            className={`rounded-lg border border-border bg-card overflow-hidden text-left ${
                              agotada
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:border-primary/50"
                            }`}
                          >
                            <span className="relative block aspect-[4/3] w-full bg-muted">
                              <Image
                                src={proteinaImgs[prot]}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="100px"
                              />
                            </span>
                            <span className="block px-1 py-1.5 text-[10px] sm:text-xs font-medium text-center leading-tight">
                              {prot}
                            </span>
                          </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {!catalog?.isCategoriaOut(BEBIDAS_CATEGORIA_ID) && (
                  <div>
                    <p className="text-sm font-medium mb-2">Bebidas</p>
                    <div className="grid grid-cols-2 gap-2">
                      {bebidas.map(beb => {
                        const agotada = catalog?.isBebidaOut(beb.id) ?? false
                        return (
                        <Button
                          key={beb.id}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          disabled={agotada}
                          onClick={() => {
                            if (agotada) return
                            addBebidaToEdit(beb)
                          }}
                        >
                          {beb.nombre}
                        </Button>
                        )
                      })}
                    </div>
                  </div>
                  )}
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

          {/* Para llevar: solo pago en línea (obligatorio). */}
          {canPay && isPickup && (
            <div className="w-full space-y-3">
              <Button
                className="w-full gap-2"
                size="lg"
                type="button"
                onClick={handlePayOnline}
                disabled={payOnlineLoading}
              >
                <CreditCard className="h-4 w-4" />
                {payOnlineLoading
                  ? "Abriendo pago seguro…"
                  : `Pagar ahora — $${order.total.toFixed(2)}`}
              </Button>
              {payOnlineError ? (
                <p className="text-sm text-destructive text-center" role="alert">
                  {payOnlineError}
                </p>
              ) : null}
              <p className="text-center text-xs text-muted-foreground px-1">
                Para llevar el pedido solo se confirma con pago en línea (Stripe). No hay pago en caja al
                recoger.
              </p>
            </div>
          )}

          {canPay && !isPickup && (
            <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2" size="lg" type="button">
                  <CreditCard className="h-4 w-4" />
                  {`Indicar forma de pago — $${order.total.toFixed(2)}`}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: 'var(--font-heading)' }}>
                    {paymentComplete ? "Registro recibido" : "Método de pago"}
                  </DialogTitle>
                  {!paymentComplete && (
                    <DialogDescription>
                      El personal confirmará en caja cuando reciba el dinero.
                    </DialogDescription>
                  )}
                </DialogHeader>

                {paymentComplete ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="h-8 w-8 text-amber-700 dark:text-amber-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      Pendiente de confirmación en caja
                    </h3>
                    <p className="text-muted-foreground mb-4 text-sm px-2">
                      Registramos tu forma de pago. Caja marcará como pagado cuando reciba el efectivo o la tarjeta.
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
                          <p className="text-sm text-muted-foreground">
                            Débito o crédito
                          </p>
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
                          <p className="text-sm text-muted-foreground">
                            Paga en mesa o al recoger
                          </p>
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
                        {`Registrar forma de pago — $${order.total.toFixed(2)}`}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          )}

          {hasPaymentIntent && !isPaid && (
            <p className="text-center text-sm text-muted-foreground">
              Esperando que caja confirme el pago… Esta página se actualiza sola.
            </p>
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
