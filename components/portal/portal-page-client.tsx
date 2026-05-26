"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useOrders, type OrderItem, type OrderType } from "@/components/orders-provider"
import {
  insertAvosOrderForPortal,
  portalUpdateOrderDelivery,
  portalUpdateOrderTipo,
  staffConfirmAvosOrderPayment,
  updateAvosOrderCartForPortal,
} from "@/lib/avos-orders-sync"
import {
  type PortalDeliveryInfo,
  portalDeliveryFromOrder,
  portalItemsTotalWithDelivery,
  portalOrderNeedsDeliveryInfo,
} from "@/lib/portal-delivery"
import { cartItemNeedsCompletion } from "@/lib/portal-cart-item"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import {
  bebidaTamanoLabels,
  categorias,
  bebidas,
  getBebidaPrecioDefault,
  getPlatillosForCategoria,
  proteinas,
  type BebidaTamano,
  type Proteina,
} from "@/lib/menu-data"
import { BebidaThumb } from "@/components/bebida-thumb"
import { useBebidaImagenes } from "@/lib/use-bebida-imagenes"
import { useProteinaImagenes } from "@/lib/use-proteina-imagenes"
import {
  Plus,
  Minus,
  Trash2,
  ChefHat,
  CreditCard,
  Banknote,
  Home,
  PanelLeft,
  UserCircle,
} from "lucide-react"
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
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { StaffProfile } from "@/lib/profile-types"
import {
  PortalAiChat,
  type PortalAiChatHandle,
} from "@/components/portal/portal-ai-chat"
import { PortalOrdersPanel } from "@/components/portal/portal-orders-panel"
import { PortalOrderSubmitBar } from "@/components/portal/portal-order-submit-bar"
import { orderItemsTotal } from "@/lib/portal-menu-snapshot"
import { applyPortalCartItemUpdate } from "@/lib/portal-cart-item"
import { cn } from "@/lib/utils"

type CreatedOrderBanner = {
  id: string
  numero: number
  total: number
  synced: boolean
}

export function PortalPageClient() {
  const { addOrder, getNextOrderNumber, orders, updateOrder, updateOrderStatus } =
    useOrders()
  const { catalog } = useMenuCatalogContext()
  const proteinaImgs = useProteinaImagenes()
  const bebidaImgs = useBebidaImagenes()

  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [cashierName, setCashierName] = useState("")
  const [draftItems, setDraftItems] = useState<OrderItem[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [menuTab, setMenuTab] = useState("tacos")
  const [orderCreated, setOrderCreated] = useState<CreatedOrderBanner | null>(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [cashLoading, setCashLoading] = useState(false)
  const [cardTerminalLoading, setCardTerminalLoading] = useState(false)
  const [paymentError, setPaymentError] = useState("")
  const [submitLoading, setSubmitLoading] = useState(false)
  const [ordersSheetOpen, setOrdersSheetOpen] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const [draftOrderTipo, setDraftOrderTipo] = useState<OrderType>("mesa")
  const [draftDelivery, setDraftDelivery] = useState<PortalDeliveryInfo>({})
  const menuRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<PortalAiChatHandle>(null)

  const scrollToMenu = useCallback(() => {
    const el = menuRef.current
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    const scrollParent = el.closest(".overflow-auto")
    if (scrollParent instanceof HTMLElement) {
      const top = el.offsetTop - 16
      scrollParent.scrollTo({ top, behavior: "smooth" })
    }
  }, [])

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

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : null),
    [orders, selectedOrderId],
  )

  const activeItems = selectedOrder ? selectedOrder.items : draftItems
  const orderTipo = selectedOrder?.tipo ?? draftOrderTipo

  const activeDelivery = useMemo(
    (): PortalDeliveryInfo =>
      selectedOrder
        ? portalDeliveryFromOrder(selectedOrder)
        : draftDelivery,
    [selectedOrder, draftDelivery],
  )

  const itemsSubtotal = orderItemsTotal(activeItems)
  const total = portalItemsTotalWithDelivery(
    itemsSubtotal,
    orderTipo,
    activeDelivery,
  )
  const needsDelivery = portalOrderNeedsDeliveryInfo(orderTipo, activeDelivery)

  const saveDelivery = useCallback(
    (delivery: PortalDeliveryInfo) => {
      const sub = orderItemsTotal(activeItems)
      const newTotal = portalItemsTotalWithDelivery(sub, "domicilio", delivery)
      if (selectedOrder) {
        updateOrder(selectedOrder.id, {
          tipo: "domicilio",
          deliveryZoneId: delivery.deliveryZoneId,
          deliveryZoneLabel: delivery.deliveryZoneLabel,
          deliveryFee: delivery.deliveryFee,
          deliveryAddress: delivery.deliveryAddress,
          total: newTotal,
        })
        if (delivery.deliveryZoneId && delivery.deliveryAddress) {
          void portalUpdateOrderDelivery(selectedOrder.id, {
            deliveryZoneId: delivery.deliveryZoneId,
            deliveryZoneLabel: delivery.deliveryZoneLabel ?? "",
            deliveryFee: delivery.deliveryFee ?? 0,
            deliveryAddress: delivery.deliveryAddress,
            total: newTotal,
          }).then((result) => {
            if (!result.ok) {
              setPaymentError(result.error ?? "No se pudo guardar la entrega.")
            }
          })
        }
      } else {
        setDraftDelivery(delivery)
        setDraftOrderTipo("domicilio")
      }
    },
    [activeItems, selectedOrder, updateOrder],
  )

  const setOrderTipo = useCallback(
    (tipo: OrderType) => {
      const sub = orderItemsTotal(activeItems)
      const cleared: PortalDeliveryInfo =
        tipo === "domicilio"
          ? activeDelivery
          : {
              deliveryZoneId: undefined,
              deliveryZoneLabel: undefined,
              deliveryFee: undefined,
              deliveryAddress: undefined,
            }
      const newTotal = portalItemsTotalWithDelivery(sub, tipo, cleared)
      if (selectedOrder) {
        updateOrder(selectedOrder.id, {
          tipo,
          ...cleared,
          total: newTotal,
        })
        void portalUpdateOrderTipo(selectedOrder.id, tipo).then((result) => {
          if (!result.ok) {
            setPaymentError(result.error ?? "No se pudo guardar el tipo de orden.")
          }
        })
      } else {
        setDraftOrderTipo(tipo)
        if (tipo !== "domicilio") setDraftDelivery({})
      }
    },
    [activeItems, activeDelivery, selectedOrder, updateOrder],
  )
  const setActiveItems = useCallback(
    (items: OrderItem[]) => {
      if (selectedOrder) {
        const sub = orderItemsTotal(items)
        const newTotal = portalItemsTotalWithDelivery(
          sub,
          selectedOrder.tipo,
          portalDeliveryFromOrder(selectedOrder),
        )
        updateOrder(selectedOrder.id, { items, total: newTotal })
      } else {
        setDraftItems(items)
      }
    },
    [selectedOrder, updateOrder],
  )

  const nextNum = getNextOrderNumber()
  const displayOrderNum = selectedOrder?.numero ?? nextNum

  const submitLabel = selectedOrder
    ? "Guardar cambios"
    : `Enviar orden #${nextNum}`
  const submitLoadingLabel = selectedOrder ? "Guardando…" : "Enviando…"

  const activateAddToOrder = useCallback(() => {
    if (activeItems.length > 0) {
      setAddMode(true)
      requestAnimationFrame(() => chatRef.current?.focusInput())
    } else {
      scrollToMenu()
    }
  }, [activeItems.length, scrollToMenu])

  const startNewOrder = useCallback(() => {
    setSelectedOrderId(null)
    setDraftItems([])
    setDraftOrderTipo("mesa")
    setDraftDelivery({})
    setAddMode(false)
    setOrderCreated(null)
    setPaymentError("")
    chatRef.current?.resetChat()
  }, [])

  useEffect(() => {
    if (activeItems.length === 0) {
      setAddMode(false)
    }
  }, [activeItems.length])

  useEffect(() => {
    void (async () => {
      const supabase = createBrowserSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("users")
        .select("id, email, full_name, role")
        .eq("id", user.id)
        .maybeSingle()
      if (data) {
        const p = data as StaffProfile
        setProfile(p)
        setCashierName(p.full_name?.trim() || p.email?.split("@")[0] || "Staff")
      }
    })()
  }, [])

  const takerName = profile?.full_name?.trim() || "Staff"

  const addItem = (
    categoria: (typeof categorias)[number],
    proteina?: Proteina,
    platillo?: { id: string; nombre: string; precioBase: number },
  ) => {
    const platilloNombre = platillo?.nombre ?? categoria.nombre
    const platilloId = platillo?.id ?? categoria.id
    const precio = proteina
      ? catalog?.getPrecioConProteina(categoria.id, proteina, platillo?.id) ??
        (proteina === "Camarón"
          ? (platillo?.precioBase ?? categoria.precioBase) + 20
          : platillo?.precioBase ?? categoria.precioBase)
      : platillo
        ? catalog?.getPlatilloPrecio(categoria.id, platillo.id) ?? platillo.precioBase
        : catalog?.getCategoriaPrecioBase(categoria.id) ?? categoria.precioBase

    const config =
      customizationsCtx?.customizations?.getConfig(categoria.id, platilloId) ??
      defaultPlatilloCustomizationConfig()
    const baseId = `${categoria.id}-${platilloId}-${proteina || "default"}`
    const itemId = cartLineKey(baseId, pendingExtras, pendingCustomNote, config)
    const notas = formatOrderItemNotas(pendingExtras, pendingCustomNote, config)
    const existingItem = activeItems.find((i) => i.id === itemId)

    const next = existingItem
      ? activeItems.map((item) =>
          item.id === itemId ? { ...item, cantidad: item.cantidad + 1 } : item,
        )
      : [
          ...activeItems,
          {
            id: itemId,
            categoria: categoria.id,
            nombre: proteina ? `${platilloNombre} de ${proteina}` : platilloNombre,
            proteina,
            cantidad: 1,
            precio,
            notas,
          },
        ]
    setActiveItems(next)
    setAddMode(true)
    setPendingExtras(defaultOrderExtras(config))
    setPendingCustomNote("")
  }

  const addBebida = (bebida: (typeof bebidas)[number], tamano: BebidaTamano) => {
    const itemId = `${bebida.id}-${tamano}`
    const unit =
      catalog?.getBebidaPrecio(bebida.id, tamano) ??
      getBebidaPrecioDefault(bebida, tamano)
    const existingItem = activeItems.find((i) => i.id === itemId)
    const next = existingItem
      ? activeItems.map((item) =>
          item.id === itemId ? { ...item, cantidad: item.cantidad + 1 } : item,
        )
      : [
          ...activeItems,
          {
            id: itemId,
            categoria: "bebidas",
            nombre: `${bebida.nombre} (${bebidaTamanoLabels[tamano]})`,
            cantidad: 1,
            precio: unit,
          },
        ]
    setActiveItems(next)
    setAddMode(true)
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setActiveItems(
      activeItems
        .map((item) => {
          if (item.id === itemId) {
            const q = item.cantidad + delta
            return q > 0 ? { ...item, cantidad: q } : item
          }
          return item
        })
        .filter((item) => item.cantidad > 0),
    )
  }

  const removeItem = (itemId: string) => {
    setActiveItems(activeItems.filter((item) => item.id !== itemId))
  }

  const retrySyncOrder = async () => {
    if (!orderCreated || orderCreated.synced) return
    setSubmitLoading(true)
    setPaymentError("")
    const local = orders.find((o) => o.id === orderCreated.id)
    if (!local) {
      setPaymentError("Orden no encontrada localmente.")
      setSubmitLoading(false)
      return
    }
    const result = await insertAvosOrderForPortal(local)
    setSubmitLoading(false)
    if (result.ok) {
      setOrderCreated({ ...orderCreated, synced: true })
    } else {
      setPaymentError(result.error ?? "No se pudo guardar en el servidor.")
    }
  }

  const submitOrder = async () => {
    if (activeItems.length === 0) return

    const incomplete = activeItems.filter(cartItemNeedsCompletion)
    if (incomplete.length > 0) {
      setPaymentError(
        `Hay ${incomplete.length} línea(s) en rojo (falta proteína, bebida o tamaño). Corrígelas antes de enviar.`,
      )
      chatRef.current?.openItemFixPicker(incomplete[0].id)
      return
    }

    if (needsDelivery) {
      setPaymentError(
        "Domicilio: toca la línea roja en el pedido para elegir zona y dirección.",
      )
      return
    }

    setSubmitLoading(true)
    setPaymentError("")

    if (selectedOrder) {
      const promises: Promise<{ ok: boolean; error?: string }>[] = [
        updateAvosOrderCartForPortal(selectedOrder.id, activeItems, total),
        portalUpdateOrderTipo(selectedOrder.id, orderTipo),
      ]
      if (
        orderTipo === "domicilio" &&
        activeDelivery.deliveryZoneId &&
        activeDelivery.deliveryAddress
      ) {
        promises.push(
          portalUpdateOrderDelivery(selectedOrder.id, {
            deliveryZoneId: activeDelivery.deliveryZoneId,
            deliveryZoneLabel: activeDelivery.deliveryZoneLabel ?? "",
            deliveryFee: activeDelivery.deliveryFee ?? 0,
            deliveryAddress: activeDelivery.deliveryAddress,
            total,
          }),
        )
      }
      const results = await Promise.all(promises)
      setSubmitLoading(false)
      const failed = results.find((r) => !r.ok)
      if (failed) {
        setPaymentError(failed.error ?? "No se pudo guardar en el servidor.")
      }
      return
    }

    const order = addOrder({
      tipo: orderTipo,
      items: activeItems,
      status: "pendiente",
      total,
      deliveryZoneId: activeDelivery.deliveryZoneId,
      deliveryZoneLabel: activeDelivery.deliveryZoneLabel,
      deliveryFee: activeDelivery.deliveryFee,
      deliveryAddress: activeDelivery.deliveryAddress,
    })
    const result = await insertAvosOrderForPortal(order)
    if (result.ok) {
      setOrderCreated({
        id: order.id,
        numero: order.numero,
        total: order.total,
        synced: true,
      })
      setDraftItems([])
      setAddMode(false)
      chatRef.current?.resetChat()
      requestAnimationFrame(() => chatRef.current?.focusInput())
    } else {
      setOrderCreated({
        id: order.id,
        numero: order.numero,
        total: order.total,
        synced: false,
      })
      setPaymentError(
        result.error ??
          "No se pudo guardar en el servidor. Revisa tu conexión e intenta de nuevo.",
      )
    }
    setSubmitLoading(false)
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
          body: JSON.stringify({ orderId: orderCreated.id, context: "staff_pos" }),
        })
        const data = (await res.json()) as { url?: string; error?: string }
        if (!res.ok || !data.url) {
          setPaymentError(data.error ?? "No se pudo iniciar Stripe.")
          setStripeLoading(false)
          return
        }
        window.location.href = data.url
      } catch {
        setPaymentError("Error de red.")
        setStripeLoading(false)
      }
    })()
  }

  const confirmCash = () => {
    if (!orderCreated?.synced) return
    setCashLoading(true)
    void staffConfirmAvosOrderPayment(orderCreated.id, "efectivo").then((ok) => {
      setCashLoading(false)
      if (ok) {
        updateOrder(orderCreated.id, { status: "pagado" })
        setOrderCreated(null)
      } else setPaymentError("No se registró el pago.")
    })
  }

  const confirmCardAtRegister = () => {
    if (!orderCreated?.synced) return
    setCardTerminalLoading(true)
    void staffConfirmAvosOrderPayment(orderCreated.id, "tarjeta").then((ok) => {
      setCardTerminalLoading(false)
      if (ok) {
        updateOrder(orderCreated.id, { status: "pagado" })
        setOrderCreated(null)
      } else setPaymentError("No se registró el pago.")
    })
  }

  const ordersPanel = (
    <PortalOrdersPanel
      orders={orders}
      selectedOrderId={selectedOrderId}
      onOrderStatusChange={(orderId, status) => {
        updateOrderStatus(orderId, status)
        if (
          selectedOrderId === orderId &&
          status !== "pendiente" &&
          status !== "preparando"
        ) {
          setSelectedOrderId(null)
        }
      }}
      onSelectOrder={(id) => {
        setSelectedOrderId(id)
        setOrdersSheetOpen(false)
        setOrderCreated(null)
        setPaymentError("")
        if (id) {
          const order = orders.find((o) => o.id === id)
          if (order && order.items.length > 0) {
            setAddMode(true)
            requestAnimationFrame(() => {
              chatRef.current?.openOrder(order.items)
            })
          } else {
            requestAnimationFrame(() => chatRef.current?.focusInput())
          }
        } else {
          chatRef.current?.resetChat()
        }
      }}
      onStartNewOrder={() => {
        startNewOrder()
        setOrdersSheetOpen(false)
      }}
      nextOrderNumber={nextNum}
    />
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b bg-card shrink-0">
        <div className="px-4 py-2 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity"
          >
            <Home className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <span
              className="font-bold text-primary text-sm sm:text-base"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              AVOS
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Inicio
            </span>
          </Link>
          <Link
            href="/staff/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Panel de personal
          </Link>
        </div>
      </div>
      <header className="bg-primary text-primary-foreground shrink-0">
        <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="rounded-xl bg-primary-foreground/15 px-4 py-2 text-center shrink-0">
              <p className="text-[10px] uppercase tracking-wide opacity-80">Orden</p>
              <p className="text-3xl font-bold leading-none">#{displayOrderNum}</p>
            </div>
            <div className="min-w-0 space-y-0.5">
              <h1
                className="text-lg font-bold truncate"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Portal de caja
              </h1>
              <p className="text-xs opacity-90 flex items-center gap-1 truncate">
                <UserCircle className="h-3.5 w-3.5 shrink-0" />
                Tomando: <strong className="font-semibold">{takerName}</strong>
              </p>
            </div>
          </div>

          <nav
            className="flex items-center gap-1 shrink-0"
            aria-label="Portal de caja"
          >
            <Link href="/cocina">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <ChefHat className="h-4 w-4" />
                Cocina
              </Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                startNewOrder()
                setOrdersSheetOpen(false)
                requestAnimationFrame(() => chatRef.current?.focusInput())
              }}
            >
              <Plus className="h-4 w-4" />
              Nueva orden
            </Button>
            <Sheet open={ordersSheetOpen} onOpenChange={setOrdersSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <PanelLeft className="h-4 w-4" />
                  Órdenes
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100%,280px)] p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Órdenes activas</SheetTitle>
                  <SheetDescription>
                    Selecciona una orden o crea una nueva
                  </SheetDescription>
                </SheetHeader>
                {ordersPanel}
              </SheetContent>
            </Sheet>
          </nav>

          <label className="text-xs flex items-center gap-1.5 shrink-0 ml-auto">
            <span className="opacity-80 whitespace-nowrap">Cobrando:</span>
            <Input
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              className="h-8 w-36 text-sm bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50"
              placeholder="Nombre"
            />
          </label>
        </div>
      </header>

      {orderCreated && (
        <div
          className={cn(
            "py-3 px-4 shrink-0 text-white",
            orderCreated.synced ? "bg-green-600" : "bg-amber-600",
          )}
        >
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {orderCreated.synced
                  ? `Orden #${orderCreated.numero} enviada`
                  : `Orden #${orderCreated.numero} — no guardada en servidor`}
              </p>
              <p className="text-sm text-white/85">
                Total ${orderCreated.total.toFixed(2)} · Cobro: {cashierName}
              </p>
            </div>
            {!orderCreated.synced && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={submitLoading}
                  onClick={() => void retrySyncOrder()}
                >
                  {submitLoading ? "Reintentando…" : "Reintentar guardar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white"
                  onClick={() => setOrderCreated(null)}
                >
                  Cerrar
                </Button>
              </div>
            )}
            {orderCreated.synced && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={stripeLoading}
                  onClick={() => void startStripeCheckout()}
                  className="gap-1"
                >
                  <CreditCard className="h-4 w-4" />
                  Stripe
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={cashLoading}
                  onClick={() => void confirmCash()}
                  className="gap-1"
                >
                  <Banknote className="h-4 w-4" />
                  Efectivo
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={cardTerminalLoading}
                  onClick={() => void confirmCardAtRegister()}
                  className="gap-1"
                >
                  <CreditCard className="h-4 w-4" />
                  Terminal
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white"
                  onClick={() => setOrderCreated(null)}
                >
                  Cerrar
                </Button>
              </div>
            )}
          </div>
          {paymentError && (
            <p className="text-sm text-amber-200 mt-2 max-w-6xl mx-auto">{paymentError}</p>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-56 xl:w-64 shrink-0 flex-col">
          {ordersPanel}
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          <div className="p-4 max-w-6xl mx-auto w-full space-y-4">
            {paymentError && !orderCreated && (
              <p
                className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
                role="alert"
              >
                {paymentError}
              </p>
            )}
            <PortalAiChat
              ref={chatRef}
              existingItems={activeItems}
              cartTotal={total}
              nextOrderNumber={nextNum}
              orderNumero={selectedOrder?.numero}
              orderTipo={orderTipo}
              addMode={addMode}
              delivery={activeDelivery}
              needsDelivery={needsDelivery}
              onDeliverySave={saveDelivery}
              onOrderTipoChange={setOrderTipo}
              onItemsResolved={(items) => {
                setActiveItems(items)
                if (items.length > 0) setAddMode(true)
              }}
              onUpdateItem={(itemId, update) => {
                setActiveItems(
                  applyPortalCartItemUpdate(activeItems, itemId, update, catalog),
                )
              }}
              onDeleteItem={removeItem}
              onRequestAddItem={activateAddToOrder}
            />

            {activeItems.length > 0 && (
              <PortalOrderSubmitBar
                total={total}
                submitLabel={submitLabel}
                loadingLabel={submitLoadingLabel}
                disabled={activeItems.length === 0}
                loading={submitLoading}
                onSubmit={() => void submitOrder()}
                showReadyHint={!selectedOrder}
              />
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2" ref={menuRef} id="portal-menu">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle
                      className="text-lg"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Menú
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs
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
                    >
                      <TabsList className="grid grid-cols-6 mb-4 h-auto">
                        {categorias.map((cat) => (
                          <TabsTrigger
                            key={cat.id}
                            value={cat.id}
                            className="text-xs sm:text-sm"
                          >
                            {cat.nombre}
                          </TabsTrigger>
                        ))}
                        <TabsTrigger value="bebidas" className="text-xs sm:text-sm">
                          Bebidas
                        </TabsTrigger>
                      </TabsList>

                      {categorias.map((categoria) => (
                        <TabsContent key={categoria.id} value={categoria.id}>
                          <div className="space-y-6">
                            {getPlatillosForCategoria(categoria)
                              .filter(
                                (p) =>
                                  !catalog?.isPlatilloHidden(categoria.id, p.id) &&
                                  !catalog?.isPlatilloOut(categoria.id, p.id),
                              )
                              .map((platillo) => (
                                <div key={platillo.id} className="space-y-3">
                                  <p className="font-medium">{platillo.nombre}</p>
                                  {platillo.tieneProteinas !== false ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {proteinas.map((proteina) => {
                                        const precio =
                                          catalog?.getPrecioConProteina(
                                            categoria.id,
                                            proteina,
                                            platillo.id,
                                          ) ??
                                          (proteina === "Camarón"
                                            ? platillo.precioBase + 20
                                            : platillo.precioBase)
                                        return (
                                          <Button
                                            key={proteina}
                                            variant="outline"
                                            className="h-auto p-0 flex-col overflow-hidden"
                                            onClick={() =>
                                              addItem(categoria, proteina, platillo)
                                            }
                                          >
                                            <span className="relative block w-full aspect-[4/3] bg-muted">
                                              <Image
                                                src={proteinaImgs[proteina]}
                                                alt=""
                                                fill
                                                className="object-cover"
                                                sizes="120px"
                                              />
                                            </span>
                                            <span className="font-semibold py-1.5 text-sm">
                                              {proteina}
                                            </span>
                                            <span className="text-xs text-muted-foreground pb-2">
                                              ${precio}
                                            </span>
                                          </Button>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        addItem(categoria, undefined, platillo)
                                      }
                                    >
                                      Agregar · $
                                      {catalog?.getPlatilloPrecio(
                                        categoria.id,
                                        platillo.id,
                                      ) ?? platillo.precioBase}
                                    </Button>
                                  )}
                                </div>
                              ))}
                          </div>
                        </TabsContent>
                      ))}

                      <TabsContent value="bebidas">
                        <div className="space-y-4">
                          {bebidas.map((bebida) => (
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
                                    className="h-auto py-2 flex-col"
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
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="sticky top-4">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle
                        className="text-lg"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {selectedOrder ? `Orden #${selectedOrder.numero}` : `Orden #${nextNum}`}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className={cn(
                            "h-8 w-8",
                            addMode &&
                              activeItems.length > 0 &&
                              "border-green-500 text-green-700 bg-green-50",
                          )}
                          title={
                            activeItems.length > 0
                              ? "Agregar más a esta orden (IA)"
                              : "Agregar del menú"
                          }
                          aria-label="Agregar artículo"
                          onClick={activateAddToOrder}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        {selectedOrder && (
                          <Badge variant="secondary" className="text-xs">
                            Editando
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedOrder && (
                      <OrderItemExtrasPicker
                        config={pendingConfig}
                        extras={pendingExtras}
                        customNote={pendingCustomNote}
                        onExtrasChange={setPendingExtras}
                        onCustomNoteChange={setPendingCustomNote}
                        compact
                      />
                    )}

                    <div className="border-t pt-3 space-y-2 max-h-64 overflow-y-auto">
                      {activeItems.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-6">
                          Menú manual o escribe en la IA arriba
                        </p>
                      ) : (
                        activeItems.map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-md -mx-1 px-1",
                              (item.needsProteina ||
                                item.needsBebidaTamano ||
                                item.needsBebidaEleccion) &&
                                "border border-destructive/50 bg-destructive/5 py-1",
                            )}
                          >
                            <button
                              type="button"
                              className={cn(
                                "min-w-0 flex-1 text-left",
                                (item.needsProteina ||
                                item.needsBebidaTamano ||
                                item.needsBebidaEleccion) &&
                                  "cursor-pointer",
                              )}
                              onClick={() => {
                                if (
                                  item.needsProteina ||
                                  item.needsBebidaTamano ||
                                  item.needsBebidaEleccion
                                ) {
                                  chatRef.current?.openItemFixPicker(item.id)
                                }
                              }}
                            >
                              <p
                                className={cn(
                                  "text-sm font-medium truncate",
                                  (item.needsProteina ||
                                item.needsBebidaTamano ||
                                item.needsBebidaEleccion) &&
                                    "text-destructive",
                                )}
                              >
                                {item.nombre}
                              </p>
                              {item.notas && (
                                <p className="text-xs text-primary/90 line-clamp-1">
                                  {item.notas}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                ${item.precio} × {item.cantidad}
                              </p>
                              {item.needsProteina && (
                                <p className="text-xs text-destructive">
                                  Toca para elegir proteína
                                </p>
                              )}
                              {item.needsBebidaEleccion && (
                                <p className="text-xs text-destructive">
                                  Toca para elegir bebida
                                </p>
                              )}
                              {item.needsBebidaTamano && (
                                <p className="text-xs text-destructive">
                                  Toca para elegir tamaño (chico / grande)
                                </p>
                              )}
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-5 text-center text-sm">{item.cantidad}</span>
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
                        ))
                      )}
                    </div>

                    <PortalOrderSubmitBar
                      total={total}
                      submitLabel={submitLabel}
                      loadingLabel={submitLoadingLabel}
                      disabled={activeItems.length === 0}
                      loading={submitLoading}
                      onSubmit={() => void submitOrder()}
                      showReadyHint={!selectedOrder}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
