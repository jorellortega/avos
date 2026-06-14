"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MenuCategoryTabBar } from "@/components/menu-category-tab-bar"
import { useOrders, OrderItem } from "@/components/orders-provider"
import { insertAvosOrderToSupabase, staffConfirmAvosOrderPayment } from "@/lib/avos-orders-sync"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import { PlatilloOrderPicker } from "@/components/platillo-order-picker"
import {
  platilloCartSuffix,
  platilloLineNombre,
  platilloPickerFlags,
} from "@/lib/platillo-config"
import {
  bebidaTamanoLabels,
  getPlatilloPrecioDefault,
  getPlatilloPrecioProteinaTamanoDefault,
  categorias,
  getBebidaPrecioDefault,
  getPlatillosForCategoria,
  Proteina,
  type BebidaTamano,
  type CategoriaPlatillo,
} from "@/lib/menu-data"
import { BebidaThumb } from "@/components/bebida-thumb"
import { useBebidaImagenes } from "@/lib/use-bebida-imagenes"
import { useProteinaImagenes } from "@/lib/use-proteina-imagenes"
import { Plus, Minus, Trash2, ChefHat, Users, ArrowLeft, QrCode, CreditCard, Banknote } from "lucide-react"
import { OrderItemExtrasPicker } from "@/components/order-item-extras-picker"
import {
  useCustomizationConfig,
  useOrderCustomizationsContextOptional,
} from "@/components/order-customizations-provider"
import {
  defaultOrderExtras,
  defaultPlatilloCustomizationConfig,
} from "@/lib/order-item-customizations"
import { cartLineKey, formatOrderItemNotas } from "@/lib/order-item-extras"

type CreatedOrderBanner = {
  id: string
  numero: number
  total: number
  synced: boolean
}

export default function StaffPage() {
  const { addOrder, getNextOrderNumber, orders, updateOrder } = useOrders()
  const { catalog } = useMenuCatalogContext()
  const proteinaImgs = useProteinaImagenes()
  const bebidaImgs = useBebidaImagenes()
  const [currentItems, setCurrentItems] = useState<OrderItem[]>([])
  const [nombreCliente, setNombreCliente] = useState("")
  const [mesa, setMesa] = useState("")
  const [selectedProteina, setSelectedProteina] = useState<Record<string, Proteina>>({})
  const [orderCreated, setOrderCreated] = useState<CreatedOrderBanner | null>(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [cashLoading, setCashLoading] = useState(false)
  const [cardTerminalLoading, setCardTerminalLoading] = useState(false)
  const [paymentError, setPaymentError] = useState("")
  const [menuTab, setMenuTab] = useState<string>("tacos")
  const menuCategoryTabs = useMemo(
    () => [
      ...categorias.map((c) => ({ id: c.id, label: c.nombre })),
      { id: "bebidas", label: "Bebidas" },
    ],
    [],
  )
  const customizationsCtx = useOrderCustomizationsContextOptional()
  const pendingPlatilloId =
    getPlatillosForCategoria(
      categorias.find((c) => c.id === menuTab) ?? categorias[0],
    )[0]?.id ?? menuTab
  const pendingConfig = useCustomizationConfig(menuTab, pendingPlatilloId)
  const [pendingExtras, setPendingExtras] = useState<string[]>(() =>
    defaultOrderExtras(pendingConfig),
  )
  const [pendingCustomNote, setPendingCustomNote] = useState("")

  const addPlatillo = (
    categoria: (typeof categorias)[number],
    platillo: CategoriaPlatillo,
    proteina?: Proteina,
    tamano?: BebidaTamano,
    opcionId?: string,
  ) => {
    const flags = platilloPickerFlags(platillo, categoria)
    const platilloId = platillo.id
    const tam = flags.tieneTamanos ? (tamano ?? "chico") : undefined
    const precio = flags.tieneProteinas && proteina
      ? catalog?.getPrecioConProteina(
          categoria.id,
          proteina,
          platilloId,
          tam,
        ) ??
        (() => {
          if (tam && proteina) {
            return getPlatilloPrecioProteinaTamanoDefault(platillo, proteina, tam)
          }
          const base = tam
            ? getPlatilloPrecioDefault(platillo, tam)
            : platillo.precioBase
          return proteina === "Camarón" ? base + 20 : base
        })()
      : tam
        ? catalog?.getPlatilloPrecioTamano(categoria.id, platilloId, tam) ??
          getPlatilloPrecioDefault(platillo, tam)
        : catalog?.getPlatilloPrecio(categoria.id, platilloId) ?? platillo.precioBase

    const config =
      customizationsCtx?.customizations?.getConfig(categoria.id, platilloId) ??
      defaultPlatilloCustomizationConfig()
    const baseId = `${categoria.id}-${platilloId}-${platilloCartSuffix(flags, tam, proteina, opcionId)}`
    const itemId = cartLineKey(baseId, pendingExtras, pendingCustomNote, config)
    const notas = formatOrderItemNotas(pendingExtras, pendingCustomNote, config)
    const displayNombre = platilloLineNombre(
      catalog?.getPlatilloNombre(categoria.id, platilloId) ?? platillo.nombre,
      flags,
      tam,
      proteina,
      platillo,
      opcionId,
    )
    const existingItem = currentItems.find((i) => i.id === itemId)

    if (existingItem) {
      setCurrentItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, cantidad: item.cantidad + 1 }
            : item,
        ),
      )
    } else {
      setCurrentItems((prev) => [
        ...prev,
        {
          id: itemId,
          categoria: categoria.id,
          nombre: displayNombre,
          proteina,
          cantidad: 1,
          precio,
          notas,
        },
      ])
    }
    setPendingExtras(defaultOrderExtras(config))
    setPendingCustomNote("")
  }

  const addItem = (
    categoria: (typeof categorias)[number],
    proteina?: Proteina,
    platillo?: CategoriaPlatillo,
    tamano?: BebidaTamano,
    opcionId?: string,
  ) => {
    if (platillo) {
      addPlatillo(categoria, platillo, proteina, tamano, opcionId)
      return
    }
    addPlatillo(
      categoria,
      {
        id: categoria.id,
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        precioBase: categoria.precioBase,
      },
      proteina,
      tamano,
      opcionId,
    )
  }

  const addBebida = (
    bebida: {
      id: string
      nombre: string
      precioChico: number
      precioGrande: number
    },
    tamano: BebidaTamano,
  ) => {
    const itemId = `${bebida.id}-${tamano}`
    const unit =
      catalog?.getBebidaPrecio(bebida.id, tamano) ??
      getBebidaPrecioDefault(bebida, tamano)
    const existingItem = currentItems.find((i) => i.id === itemId)

    if (existingItem) {
      setCurrentItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, cantidad: item.cantidad + 1 }
            : item,
        ),
      )
    } else {
      setCurrentItems((prev) => [
        ...prev,
        {
          id: itemId,
          categoria: "bebidas",
          nombre: `${bebida.nombre} (${bebidaTamanoLabels[tamano]})`,
          cantidad: 1,
          precio: unit,
        },
      ])
    }
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCurrentItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.cantidad + delta
        return newQuantity > 0 ? { ...item, cantidad: newQuantity } : item
      }
      return item
    }).filter(item => item.cantidad > 0))
  }

  const removeItem = (itemId: string) => {
    setCurrentItems(prev => prev.filter(item => item.id !== itemId))
  }

  const total = currentItems.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)

  const createOrder = async () => {
    if (currentItems.length === 0) return

    const order = addOrder({
      nombreCliente: nombreCliente || undefined,
      mesa: mesa || undefined,
      tipo: "mesa",
      items: currentItems,
      status: "pendiente",
      total
    })

    const synced = await insertAvosOrderToSupabase(order)

    setOrderCreated({
      id: order.id,
      numero: order.numero,
      total: order.total,
      synced,
    })
    setPaymentError("")
    setCurrentItems([])
    setNombreCliente("")
    setMesa("")
    setSelectedProteina({})
  }

  const startStripeCheckout = () => {
    if (!orderCreated?.synced) return
    setPaymentError("")
    setStripeLoading(true)
    void (async () => {
      try {
        const res = await fetch("/api/checkout/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: orderCreated.id,
            context: "staff_pos",
          }),
        })
        const data = (await res.json()) as { url?: string; error?: string }
        if (!res.ok || !data.url) {
          setPaymentError(data.error ?? "No se pudo iniciar el pago con tarjeta.")
          setStripeLoading(false)
          return
        }
        window.location.href = data.url
      } catch {
        setPaymentError("Error de red. Intenta de nuevo.")
        setStripeLoading(false)
      }
    })()
  }

  const confirmCash = () => {
    if (!orderCreated?.synced) return
    setPaymentError("")
    setCashLoading(true)
    void staffConfirmAvosOrderPayment(orderCreated.id, "efectivo").then((ok) => {
      setCashLoading(false)
      if (ok) {
        updateOrder(orderCreated.id, { status: "pagado" })
        setOrderCreated(null)
      } else {
        setPaymentError("No se pudo registrar el pago en efectivo.")
      }
    })
  }

  const confirmCardAtRegister = () => {
    if (!orderCreated?.synced) return
    setPaymentError("")
    setCardTerminalLoading(true)
    void staffConfirmAvosOrderPayment(orderCreated.id, "tarjeta").then((ok) => {
      setCardTerminalLoading(false)
      if (ok) {
        updateOrder(orderCreated.id, { status: "pagado" })
        setOrderCreated(null)
      } else {
        setPaymentError("No se pudo registrar el pago con tarjeta.")
      }
    })
  }

  const pendingOrders = orders.filter(o => o.status === "pendiente" || o.status === "preparando")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                Panel de Staff
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/cocina">
              <Button variant="secondary" size="sm" className="gap-2">
                <ChefHat className="h-4 w-4" />
                Cocina
              </Button>
            </Link>
            <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">
              {pendingOrders.length} órdenes activas
            </Badge>
          </div>
        </div>
      </header>

      {/* Orden creada: cobro */}
      {orderCreated && (
        <div className="bg-green-600 text-white py-4 px-4">
          <div className="container mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Orden #{orderCreated.numero} creada</p>
                  <p className="text-sm text-white/80">
                    Total ${orderCreated.total.toFixed(2)} ·{" "}
                    {orderCreated.synced
                      ? "Registra el cobro o abre Stripe para que el cliente pague con tarjeta."
                      : "No se guardó en el servidor: cobra en efectivo/tarjeta desde Órdenes y pagos cuando se sincronice."}
                  </p>
                </div>
              </div>
              <div className="text-3xl font-bold shrink-0">#{orderCreated.numero}</div>
            </div>

            {orderCreated.synced && (
              <div className="rounded-lg bg-white/10 border border-white/20 p-4 space-y-3">
                <p className="text-sm font-medium text-white/95">Cobrar ahora</p>
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2 w-full sm:w-auto justify-center"
                    disabled={stripeLoading}
                    onClick={() => void startStripeCheckout()}
                  >
                    <CreditCard className="h-4 w-4" />
                    {stripeLoading ? "Abriendo Stripe…" : "Tarjeta (Stripe en línea)"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2 w-full sm:w-auto justify-center bg-white/90 text-green-900 hover:bg-white"
                    disabled={cashLoading}
                    onClick={() => void confirmCash()}
                  >
                    <Banknote className="h-4 w-4" />
                    {cashLoading ? "…" : "Efectivo"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2 w-full sm:w-auto justify-center bg-white/90 text-green-900 hover:bg-white"
                    disabled={cardTerminalLoading}
                    onClick={() => void confirmCardAtRegister()}
                  >
                    <CreditCard className="h-4 w-4" />
                    {cardTerminalLoading ? "…" : "Tarjeta (terminal / física)"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-white hover:bg-white/20 w-full sm:w-auto"
                    onClick={() => {
                      setOrderCreated(null)
                      setPaymentError("")
                    }}
                  >
                    Cerrar
                  </Button>
                </div>
                <p className="text-xs text-white/75">
                  Stripe: el cliente ingresa la tarjeta en la pantalla segura. Efectivo y
                  terminal: queda pagado en el sistema al instante.
                </p>
              </div>
            )}

            {!orderCreated.synced && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="bg-white/90 text-amber-900"
                  onClick={() => setOrderCreated(null)}
                >
                  Entendido
                </Button>
              </div>
            )}

            {paymentError ? (
              <p className="text-sm text-amber-200 bg-black/20 rounded px-2 py-1" role="alert">
                {paymentError}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>
                  Nueva Orden - #{getNextOrderNumber()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MenuCategoryTabBar
                  value={menuTab}
                  onValueChange={(v) => {
                    setMenuTab(v)
                    const cat = categorias.find((c) => c.id === v)
                    const pid = cat
                      ? (getPlatillosForCategoria(cat)[0]?.id ?? v)
                      : v
                    const cfg =
                      customizationsCtx?.customizations?.getConfig(v, pid) ??
                      defaultPlatilloCustomizationConfig()
                    setPendingExtras(defaultOrderExtras(cfg))
                    setPendingCustomNote("")
                  }}
                  tabs={menuCategoryTabs}
                />

                  {categorias.map((categoria) =>
                    menuTab === categoria.id ? (
                    <div key={categoria.id} role="tabpanel">
                      <div className="space-y-6">
                        {getPlatillosForCategoria(categoria)
                          .filter(
                            (platillo) =>
                              !catalog?.isPlatilloHidden(categoria.id, platillo.id) &&
                              !catalog?.isPlatilloOut(categoria.id, platillo.id),
                          )
                          .map((platillo) => (
                          <div key={platillo.id} className="space-y-3">
                            <div>
                              <p className="font-medium">
                                {catalog?.getPlatilloNombre(categoria.id, platillo.id) ??
                                  platillo.nombre}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {platillo.descripcion}
                              </p>
                            </div>
                            <PlatilloOrderPicker
                              categoria={categoria}
                              platillo={platillo}
                              catalog={catalog}
                              proteinaImgs={proteinaImgs}
                              onAdd={(proteina, tam, opcionId) =>
                                addItem(
                                  categoria,
                                  proteina,
                                  platillo,
                                  tam,
                                  opcionId,
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null,
                  )}

                  {menuTab === "bebidas" ? (
                    <div role="tabpanel">
                    <div className="space-y-4">
                      {(catalog?.getBebidas() ?? []).map((bebida) => (
                        <div key={bebida.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <BebidaThumb
                              src={bebidaImgs[bebida.id]}
                              alt={bebida.nombre}
                              className="h-10 w-10"
                            />
                            <p className="text-sm font-medium">{bebida.nombre}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(["chico", "grande"] as const).map((tam) => (
                              <Button
                                key={tam}
                                variant="outline"
                                className="h-auto py-3 flex-col gap-0.5"
                                onClick={() => addBebida(bebida, tam)}
                              >
                                <span className="font-semibold text-sm">
                                  {bebidaTamanoLabels[tam]}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  $
                                  {catalog?.getBebidaPrecio(bebida.id, tam) ??
                                    getBebidaPrecioDefault(bebida, tam)}
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    </div>
                  ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>
                  Resumen de Orden
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Info */}
                <div className="space-y-3">
                  <Input
                    placeholder="Nombre del cliente (opcional)"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                  />
                  <Input
                    placeholder="Mesa (opcional)"
                    value={mesa}
                    onChange={(e) => setMesa(e.target.value)}
                  />
                </div>

                <OrderItemExtrasPicker
                  config={pendingConfig}
                  extras={pendingExtras}
                  customNote={pendingCustomNote}
                  onExtrasChange={setPendingExtras}
                  onCustomNoteChange={setPendingCustomNote}
                  compact
                />
                <p className="text-xs text-muted-foreground -mt-2">
                  Aplica al próximo platillo que agregues en la pestaña activa.
                </p>

                {/* Items */}
                <div className="border-t pt-4">
                  {currentItems.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Agrega productos del menú
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {currentItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.nombre}</p>
                            {item.notas ? (
                              <p className="text-xs text-primary/90 line-clamp-2">
                                {item.notas}
                              </p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">${item.precio} c/u</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.cantidad}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Create Order Button */}
                <Button 
                  className="w-full" 
                  size="lg"
                  disabled={currentItems.length === 0}
                  onClick={() => void createOrder()}
                >
                  Crear Orden #{getNextOrderNumber()}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
