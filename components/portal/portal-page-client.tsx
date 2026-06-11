"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MenuCategoryTabBar } from "@/components/menu-category-tab-bar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  useOrders,
  type Order,
  type OrderItem,
  type OrderStatus,
  type OrderType,
} from "@/components/orders-provider"
import {
  insertAvosOrderForPortal,
  portalUpdateOrderDelivery,
  portalUpdateOrderTipo,
  staffConfirmAvosOrderPayment,
  updateAvosOrderCartForPortal,
} from "@/lib/avos-orders-sync"
import {
  type PortalDeliveryInfo,
  portalDeliveryForTipo,
  portalDeliveryFromOrder,
  portalOrderNeedsDeliveryInfo,
  portalOrderTotal,
} from "@/lib/portal-delivery"
import {
  computeOrderDiscountAmount,
  type OrderDiscountState,
} from "@/lib/order-discount"
import { cartItemNeedsCompletion } from "@/lib/portal-cart-item"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import { PlatilloOrderPicker } from "@/components/platillo-order-picker"
import {
  platilloCartSuffix,
  platilloLineNombre,
  platilloPickerFlags,
} from "@/lib/platillo-config"
import {
  bebidaTamanoLabels,
  categorias,
  formatPlatilloTamanoPrecioRange,
  getBebidaPrecioDefault,
  getPlatilloPrecioDefault,
  getPlatilloPrecioProteinaTamanoDefault,
  getPlatillosForCategoria,
  proteinas,
  type BebidaTamano,
  type CategoriaPlatillo,
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
import {
  useOrderCustomizationsContextOptional,
} from "@/components/order-customizations-provider"
import {
  defaultOrderExtras,
  defaultPlatilloCustomizationConfig,
} from "@/lib/order-item-customizations"
import { cartLineKey, formatOrderItemNotas } from "@/lib/order-item-extras"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { isCeo, type StaffProfile } from "@/lib/profile-types"
import {
  PortalAiChat,
  type PortalAiChatHandle,
} from "@/components/portal/portal-ai-chat"
import { PortalOrdersPanel } from "@/components/portal/portal-orders-panel"
import { PortalOrderSubmitBar } from "@/components/portal/portal-order-submit-bar"
import { PortalCashChange } from "@/components/portal/portal-cash-change"
import { PortalCollectPayment } from "@/components/portal/portal-collect-payment"
import { PortalRegisterFloat } from "@/components/portal/portal-register-float"
import { PortalCartLineCustomization } from "@/components/portal/portal-cart-line-customization"
import { orderItemsTotal } from "@/lib/portal-menu-snapshot"
import {
  applyBebidaStockDelta,
  saveMenuCatalogJson,
} from "@/lib/menu-catalog-bebida-stock"
import {
  applyPortalCartItemUpdate,
  parseCartLineBaseId,
} from "@/lib/portal-cart-item"
import { cn } from "@/lib/utils"

type CreatedOrderBanner = {
  id: string
  numero: number
  total: number
  synced: boolean
}

function cloneOrderItems(items: OrderItem[]): OrderItem[] {
  return items.map((i) => ({ ...i }))
}

type PortalTodayOrdersPanelProps = ComponentProps<typeof PortalOrdersPanel>

/** Separate instances for sidebar vs sheet (do not reuse one JSX element in two parents). */
function PortalTodayOrdersPanel({
  panelKey,
  ...props
}: PortalTodayOrdersPanelProps & { panelKey: string }) {
  return <PortalOrdersPanel key={panelKey} {...props} />
}

export function PortalPageClient() {
  const {
    addOrder,
    getNextOrderNumber,
    orders,
    updateOrder,
    updateOrderStatus,
    mergeServerOrders,
  } = useOrders()
  const { catalog, refresh: refreshCatalog } = useMenuCatalogContext()
  const proteinaImgs = useProteinaImagenes()
  const bebidaImgs = useBebidaImagenes()

  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [draftItems, setDraftItems] = useState<OrderItem[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [orderEditItems, setOrderEditItems] = useState<OrderItem[] | null>(null)
  const lastOpenedOrderIdRef = useRef<string | null>(null)
  const [menuTab, setMenuTab] = useState("tacos")
  const menuCategoryTabs = useMemo(
    () => [
      ...categorias.map((c) => ({ id: c.id, label: c.nombre })),
      { id: "bebidas", label: "Bebidas" },
    ],
    [],
  )
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
  const [draftExtraCharge, setDraftExtraCharge] = useState(0)
  const [draftDiscount, setDraftDiscount] = useState<OrderDiscountState>({})
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

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : null),
    [orders, selectedOrderId],
  )

  const activeItems =
    selectedOrderId && orderEditItems ? orderEditItems : draftItems
  const orderTipo = selectedOrder?.tipo ?? draftOrderTipo

  const activeDelivery = useMemo(
    (): PortalDeliveryInfo =>
      selectedOrder
        ? portalDeliveryFromOrder(selectedOrder)
        : draftDelivery,
    [selectedOrder, draftDelivery],
  )

  const activeExtraCharge = selectedOrder?.extraCharge ?? draftExtraCharge
  const activeDiscountState: OrderDiscountState = selectedOrder
    ? selectedOrder.discountPreset
      ? { preset: selectedOrder.discountPreset }
      : selectedOrder.discountPercent
        ? { percent: selectedOrder.discountPercent }
        : {}
    : draftDiscount
  const activeDiscountAmount = useMemo(
    () => computeOrderDiscountAmount(activeItems, activeDiscountState),
    [activeItems, activeDiscountState],
  )
  const itemsSubtotal = orderItemsTotal(activeItems)
  const deliveryFeeForTotal =
    orderTipo === "domicilio" ? (activeDelivery.deliveryFee ?? 0) : 0
  const total = portalOrderTotal(
    itemsSubtotal,
    orderTipo,
    activeDelivery,
    activeExtraCharge,
    activeDiscountAmount,
  )

  const applyDiscount = useCallback(
    (state: OrderDiscountState) => {
      const amount = computeOrderDiscountAmount(activeItems, state)
      const sub = orderItemsTotal(activeItems)
      const newTotal = portalOrderTotal(
        sub,
        orderTipo,
        activeDelivery,
        selectedOrder?.extraCharge ?? draftExtraCharge,
        amount,
      )
      const patch: Partial<Order> = {
        discountPreset: state.preset,
        discountPercent:
          !state.preset && state.percent && state.percent > 0
            ? state.percent
            : undefined,
        discountAmount: amount > 0 ? amount : undefined,
        total: newTotal,
      }
      if (selectedOrder) {
        updateOrder(selectedOrder.id, patch)
      } else {
        setDraftDiscount(state)
      }
    },
    [
      activeItems,
      orderTipo,
      activeDelivery,
      selectedOrder,
      draftExtraCharge,
      updateOrder,
    ],
  )
  const needsDelivery = portalOrderNeedsDeliveryInfo(orderTipo, activeDelivery)

  const applyExtraCharge = useCallback(
    (amount: number) => {
      const extra = Math.max(0, Math.round(amount * 100) / 100)
      const sub = orderItemsTotal(activeItems)
      const newTotal = portalOrderTotal(
        sub,
        orderTipo,
        activeDelivery,
        extra,
        activeDiscountAmount,
      )
      if (selectedOrder) {
        updateOrder(selectedOrder.id, { extraCharge: extra, total: newTotal })
      } else {
        setDraftExtraCharge(extra)
      }
    },
    [activeItems, orderTipo, activeDelivery, selectedOrder, updateOrder, activeDiscountAmount],
  )

  const saveDelivery = useCallback(
    (delivery: PortalDeliveryInfo) => {
      const sub = orderItemsTotal(activeItems)
      const newTotal = portalOrderTotal(
        sub,
        "domicilio",
        delivery,
        selectedOrder?.extraCharge ?? draftExtraCharge,
        activeDiscountAmount,
      )
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
    [activeItems, selectedOrder, draftExtraCharge, updateOrder, activeDiscountAmount],
  )

  const applyDeliveryFee = useCallback(
    (fee: number) => {
      if (orderTipo !== "domicilio") return
      saveDelivery({
        ...activeDelivery,
        deliveryFee: Math.max(0, Math.round(fee * 100) / 100),
      })
    },
    [orderTipo, activeDelivery, saveDelivery],
  )

  const setOrderTipo = useCallback(
    (tipo: OrderType) => {
      const sub = orderItemsTotal(activeItems)
      const deliveryInfo = portalDeliveryForTipo(tipo, activeDelivery)
      const newTotal = portalOrderTotal(
        sub,
        tipo,
        deliveryInfo,
        selectedOrder?.extraCharge ?? draftExtraCharge,
        computeOrderDiscountAmount(
          activeItems,
          selectedOrder
            ? selectedOrder.discountPreset
              ? { preset: selectedOrder.discountPreset }
              : selectedOrder.discountPercent
                ? { percent: selectedOrder.discountPercent }
                : {}
            : draftDiscount,
        ),
      )
      if (selectedOrder) {
        updateOrder(selectedOrder.id, {
          tipo,
          ...deliveryInfo,
          total: newTotal,
        })
        void portalUpdateOrderTipo(selectedOrder.id, tipo).then((result) => {
          if (!result.ok) {
            setPaymentError(result.error ?? "No se pudo guardar el tipo de orden.")
          }
        })
      } else {
        setDraftOrderTipo(tipo)
        setDraftDelivery(tipo === "domicilio" ? deliveryInfo : {})
      }
    },
    [activeItems, activeDelivery, selectedOrder, draftExtraCharge, draftDiscount, updateOrder],
  )
  const setActiveItems = useCallback(
    (items: OrderItem[]) => {
      if (selectedOrderId) {
        const order = orders.find((o) => o.id === selectedOrderId)
        if (!order) return
        setOrderEditItems(items)
        const sub = orderItemsTotal(items)
        const discountState: OrderDiscountState = order.discountPreset
          ? { preset: order.discountPreset }
          : order.discountPercent
            ? { percent: order.discountPercent }
            : {}
        const discountAmt = computeOrderDiscountAmount(items, discountState)
        const newTotal = portalOrderTotal(
          sub,
          order.tipo,
          portalDeliveryFromOrder(order),
          order.extraCharge ?? 0,
          discountAmt,
        )
        updateOrder(selectedOrderId, {
          items,
          total: newTotal,
          discountAmount: discountAmt > 0 ? discountAmt : undefined,
        })
      } else {
        setDraftItems(items)
      }
    },
    [selectedOrderId, orders, updateOrder],
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
    setOrderEditItems(null)
    lastOpenedOrderIdRef.current = null
    setDraftItems([])
    setDraftOrderTipo("mesa")
    setDraftDelivery({})
    setDraftExtraCharge(0)
    setAddMode(false)
    setOrderCreated(null)
    setPaymentError("")
    chatRef.current?.resetChat()
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/portal/today-orders", {
          credentials: "same-origin",
        })
        const data = (await res.json()) as {
          orders?: Order[]
          error?: string
        }
        if (!res.ok || !data.orders) return
        const parsed = data.orders.map((o) => ({
          ...o,
          createdAt: new Date(o.createdAt),
          updatedAt: new Date(o.updatedAt),
        }))
        mergeServerOrders(parsed)
      } catch {
        /* local orders still work */
      }
    })()
  }, [mergeServerOrders])

  useEffect(() => {
    if (!selectedOrderId) {
      setOrderEditItems(null)
      if (lastOpenedOrderIdRef.current !== null) {
        lastOpenedOrderIdRef.current = null
        chatRef.current?.resetChat()
      }
      return
    }

    const order = orders.find((o) => o.id === selectedOrderId)
    if (!order) {
      setOrderEditItems(null)
      return
    }

    setOrderEditItems(cloneOrderItems(order.items))

    if (lastOpenedOrderIdRef.current === selectedOrderId) return
    lastOpenedOrderIdRef.current = selectedOrderId

    setOrderCreated(null)
    setPaymentError("")
    if (order.items.length > 0) {
      setAddMode(true)
      requestAnimationFrame(() => {
        chatRef.current?.openOrder(cloneOrderItems(order.items))
      })
    } else {
      setAddMode(false)
      requestAnimationFrame(() => chatRef.current?.focusInput())
    }
    // Only re-init editor when switching orders — not on every cart line update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId])

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
        setProfile(data as StaffProfile)
      }
    })()
  }, [])

  const takerName = profile?.full_name?.trim() || "Staff"
  const canEditRegisterFloat = isCeo(profile?.role)

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
    const extras = defaultOrderExtras(config)
    const itemId = cartLineKey(baseId, extras, "", config)
    const notas = formatOrderItemNotas(extras, "", config)
    const displayNombre = platilloLineNombre(
      platillo.nombre,
      flags,
      tam,
      proteina,
      platillo,
      opcionId,
    )
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
            nombre: displayNombre,
            proteina,
            cantidad: 1,
            precio,
            notas,
          },
        ]
    setActiveItems(next)
    setAddMode(true)
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

  const updateItemCustomization = (
    itemId: string,
    extras: string[],
    customNote: string,
  ) => {
    const item = activeItems.find((i) => i.id === itemId)
    if (!item) return
    const parsed = parseCartLineBaseId(itemId)
    if (!parsed) return

    const config =
      customizationsCtx?.customizations?.getConfig(
        parsed.categoriaId,
        parsed.platilloId,
      ) ?? defaultPlatilloCustomizationConfig()
    const baseId = `${parsed.categoriaId}-${parsed.platilloId}-${parsed.proteina || "default"}`
    const newId = cartLineKey(baseId, extras, customNote, config)
    const notas = formatOrderItemNotas(extras, customNote, config)

    if (newId === itemId) {
      setActiveItems(
        activeItems.map((i) => (i.id === itemId ? { ...i, notas } : i)),
      )
      return
    }

    const without = activeItems.filter((i) => i.id !== itemId)
    const existing = without.find((i) => i.id === newId)
    if (existing) {
      setActiveItems(
        without
          .map((i) =>
            i.id === newId
              ? { ...i, cantidad: i.cantidad + item.cantidad, notas }
              : i,
          )
          .filter((i) => i.cantidad > 0),
      )
      return
    }

    setActiveItems([...without, { ...item, id: newId, notas }])
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

  const persistBebidaStockAfterSale = useCallback(
    async (beforeItems: OrderItem[], afterItems: OrderItem[]) => {
      if (!catalog?.json || afterItems.length === 0) return
      const nextJson = applyBebidaStockDelta(
        catalog.json,
        beforeItems,
        afterItems,
      )
      const saved = await saveMenuCatalogJson(nextJson)
      if (saved.ok) await refreshCatalog()
    },
    [catalog?.json, refreshCatalog],
  )

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
        updateAvosOrderCartForPortal(
          selectedOrder.id,
          activeItems,
          total,
          activeExtraCharge,
          activeDiscountAmount,
          activeDiscountState.preset ?? null,
          activeDiscountState.percent ?? null,
        ),
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
        return
      }
      await persistBebidaStockAfterSale(
        selectedOrder.items ?? [],
        activeItems,
      )
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
      extraCharge: activeExtraCharge > 0 ? activeExtraCharge : undefined,
      discountAmount:
        activeDiscountAmount > 0 ? activeDiscountAmount : undefined,
      discountPreset: activeDiscountState.preset,
      discountPercent:
        !activeDiscountState.preset && activeDiscountState.percent
          ? activeDiscountState.percent
          : undefined,
    })
    const result = await insertAvosOrderForPortal(order)
    if (result.ok) {
      await persistBebidaStockAfterSale([], activeItems)
      setOrderCreated({
        id: order.id,
        numero: order.numero,
        total: order.total,
        synced: true,
      })
      setDraftItems([])
      setDraftDiscount({})
      setDraftExtraCharge(0)
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

  const handlePanelStatusChange = useCallback(
    (orderId: string, status: OrderStatus) => {
      updateOrderStatus(orderId, status)
    },
    [updateOrderStatus],
  )

  const handleSelectOrder = useCallback(
    (id: string) => {
      if (id === selectedOrderId) return
      setSelectedOrderId(id)
    },
    [selectedOrderId],
  )

  const handlePanelStartNew = useCallback(() => {
    startNewOrder()
  }, [startNewOrder])

  const ordersPanelProps = useMemo(
    () => ({
      orders,
      selectedOrderId,
      onOrderStatusChange: handlePanelStatusChange,
      onSelectOrder: handleSelectOrder,
      onStartNewOrder: handlePanelStartNew,
      nextOrderNumber: nextNum,
    }),
    [
      orders,
      selectedOrderId,
      handlePanelStatusChange,
      handleSelectOrder,
      handlePanelStartNew,
      nextNum,
    ],
  )

  const keepSheetOpenOnOutside = useCallback((e: Event) => {
    const target = e.target
    if (!(target instanceof Element)) return
    if (
      target.closest(
        '[data-slot="dropdown-menu-content"],[data-radix-popper-content-wrapper]',
      )
    ) {
      e.preventDefault()
    }
  }, [])

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
        <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-3">
          <div className="flex items-center gap-3 min-w-0">
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

          <PortalRegisterFloat
            variant="header"
            className="shrink-0"
            canEdit={canEditRegisterFloat}
          />

          <nav
            className="flex items-center gap-1 shrink-0 ml-auto"
            aria-label="Portal de caja"
          >
            <Link href="/menu">
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-black text-white hover:bg-black/90 dark:bg-black dark:hover:bg-black/90"
              >
                Menú
              </Button>
            </Link>
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
                requestAnimationFrame(() => chatRef.current?.focusInput())
              }}
            >
              <Plus className="h-4 w-4" />
              Nueva orden
            </Button>
            <div className="lg:hidden">
              <Sheet open={ordersSheetOpen} onOpenChange={setOrdersSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-1.5">
                    <PanelLeft className="h-4 w-4" />
                    Órdenes
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[min(100%,280px)] p-0"
                  onInteractOutside={keepSheetOpenOnOutside}
                  onPointerDownOutside={keepSheetOpenOnOutside}
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Órdenes de hoy</SheetTitle>
                    <SheetDescription>
                      Selecciona una orden o crea una nueva
                    </SheetDescription>
                  </SheetHeader>
                  <PortalTodayOrdersPanel panelKey="sheet" {...ordersPanelProps} />
                </SheetContent>
              </Sheet>
            </div>
          </nav>
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
                Total ${orderCreated.total.toFixed(2)} · Tomando: {takerName}
              </p>
              {orderCreated.synced && (
                <PortalCashChange
                  total={orderCreated.total}
                  variant="banner"
                  className="mt-3 max-w-sm"
                />
              )}
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
          <PortalTodayOrdersPanel panelKey="sidebar" {...ordersPanelProps} />
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
              onDeliveryFeeChange={applyDeliveryFee}
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
                itemsSubtotal={itemsSubtotal}
                deliveryFee={deliveryFeeForTotal}
                orderTipo={orderTipo}
                onOrderTipoChange={setOrderTipo}
                delivery={activeDelivery}
                needsDelivery={needsDelivery}
                onDeliverySave={saveDelivery}
                onDeliveryFeeChange={applyDeliveryFee}
                extraCharge={activeExtraCharge}
                onExtraChargeChange={applyExtraCharge}
                discountState={activeDiscountState}
                discountAmount={activeDiscountAmount}
                onDiscountChange={applyDiscount}
                submitLabel={submitLabel}
                loadingLabel={submitLoadingLabel}
                disabled={activeItems.length === 0}
                loading={submitLoading}
                onSubmit={() => void submitOrder()}
                showReadyHint={!selectedOrder}
                showCashChange={false}
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
                    <MenuCategoryTabBar
                      value={menuTab}
                      onValueChange={setMenuTab}
                      tabs={menuCategoryTabs}
                    />

                      {categorias.map((categoria) =>
                        menuTab === categoria.id ? (
                        <div key={categoria.id} role="tabpanel">
                          <div className="space-y-6">
                            {getPlatillosForCategoria(categoria)
                              .filter(
                                (p) =>
                                  !catalog?.isPlatilloHidden(categoria.id, p.id) &&
                                  !catalog?.isPlatilloOut(categoria.id, p.id),
                              )
                              .map((platillo) => (
                                <div key={platillo.id} className="space-y-3">
                                  <div>
                                    <p className="font-medium">{platillo.nombre}</p>
                                    {platillo.tieneTamanos ? (
                                      <p className="text-sm text-muted-foreground tabular-nums">
                                        {formatPlatilloTamanoPrecioRange(
                                          platillo,
                                          catalog?.getPlatilloPrecioTamano(
                                            categoria.id,
                                            platillo.id,
                                            "chico",
                                          ),
                                          catalog?.getPlatilloPrecioTamano(
                                            categoria.id,
                                            platillo.id,
                                            "grande",
                                          ),
                                        )}
                                      </p>
                                    ) : null}
                                  </div>
                                  <PlatilloOrderPicker
                                    categoria={categoria}
                                    platillo={platillo}
                                    catalog={catalog}
                                    proteinaImgs={proteinaImgs}
                                    variant="portal"
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
                          {(catalog?.getBebidas() ?? [])
                            .filter((b) => !catalog?.isBebidaHidden(b.id))
                            .map((bebida) => {
                              const agotada =
                                catalog?.isBebidaOut(bebida.id) ?? false
                              const tracksStock =
                                catalog?.bebidaTracksStock(bebida.id) ?? false
                              return (
                                <div key={bebida.id} className="space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <BebidaThumb
                                      src={bebidaImgs[bebida.id]}
                                      alt={bebida.nombre}
                                      className="h-10 w-10"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium">
                                        {bebida.nombre}
                                      </p>
                                      {tracksStock ? (
                                        <p
                                          className={cn(
                                            "text-xs",
                                            agotada
                                              ? "text-destructive font-medium"
                                              : "text-muted-foreground",
                                          )}
                                        >
                                          {agotada
                                            ? "Agotado"
                                            : `Quedan ${catalog?.getBebidaStockQty(bebida.id) ?? 0}`}
                                        </p>
                                      ) : agotada ? (
                                        <p className="text-xs text-destructive font-medium">
                                          Agotado
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {(["chico", "grande"] as const).map((tam) => (
                                      <Button
                                        key={tam}
                                        variant="outline"
                                        className="h-auto py-2 flex-col"
                                        disabled={agotada}
                                        onClick={() => addBebida(bebida, tam)}
                                      >
                                        <span className="font-semibold text-sm">
                                          {bebidaTamanoLabels[tam]}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          $
                                          {catalog?.getBebidaPrecio(
                                            bebida.id,
                                            tam,
                                          ) ??
                                            getBebidaPrecioDefault(bebida, tam)}
                                        </span>
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}
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
                    <div className="space-y-3 max-h-[min(24rem,50vh)] overflow-y-auto">
                      {activeItems.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-6">
                          Menú manual o escribe en la IA arriba
                        </p>
                      ) : (
                        activeItems.map((item) => {
                          const needsFix =
                            item.needsProteina ||
                            item.needsPlatilloTamano ||
                            item.needsBebidaTamano ||
                            item.needsBebidaEleccion
                          const showCustomization =
                            !needsFix && parseCartLineBaseId(item.id) != null

                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "rounded-md border border-border/60 px-2 py-2 space-y-2",
                                needsFix &&
                                  "border-destructive/50 bg-destructive/5",
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  className={cn(
                                    "min-w-0 flex-1 text-left",
                                    needsFix && "cursor-pointer",
                                  )}
                                  onClick={() => {
                                    if (needsFix) {
                                      chatRef.current?.openItemFixPicker(item.id)
                                    }
                                  }}
                                >
                                  <p
                                    className={cn(
                                      "text-sm font-medium truncate",
                                      needsFix && "text-destructive",
                                    )}
                                  >
                                    {item.nombre}
                                  </p>
                                  {item.notas && !showCustomization && (
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
                                  {item.needsPlatilloTamano && (
                                    <p className="text-xs text-destructive">
                                      Toca para elegir tamaño (chico / grande)
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
                                  <span className="w-5 text-center text-sm">
                                    {item.cantidad}
                                  </span>
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
                              {showCustomization ? (
                                <PortalCartLineCustomization
                                  itemId={item.id}
                                  onChange={(extras, customNote) =>
                                    updateItemCustomization(
                                      item.id,
                                      extras,
                                      customNote,
                                    )
                                  }
                                />
                              ) : null}
                            </div>
                          )
                        })
                      )}
                    </div>

                    <div className="sm:hidden">
                      <PortalRegisterFloat
                        className="border-t pt-3"
                        canEdit={canEditRegisterFloat}
                      />
                    </div>

                    {selectedOrder &&
                    selectedOrder.status !== "pagado" &&
                    activeItems.length > 0 ? (
                      <PortalCollectPayment
                        orderId={selectedOrder.id}
                        total={total}
                        disabled={submitLoading}
                        onPaid={() => {
                          updateOrderStatus(selectedOrder.id, "pagado")
                        }}
                      />
                    ) : null}

                    <PortalOrderSubmitBar
                      total={total}
                      itemsSubtotal={itemsSubtotal}
                      deliveryFee={deliveryFeeForTotal}
                      orderTipo={orderTipo}
                      onOrderTipoChange={setOrderTipo}
                      delivery={activeDelivery}
                      needsDelivery={needsDelivery}
                      onDeliverySave={saveDelivery}
                      onDeliveryFeeChange={applyDeliveryFee}
                      extraCharge={activeExtraCharge}
                      onExtraChargeChange={applyExtraCharge}
                      discountState={activeDiscountState}
                      discountAmount={activeDiscountAmount}
                      onDiscountChange={applyDiscount}
                      submitLabel={submitLabel}
                      loadingLabel={submitLoadingLabel}
                      disabled={activeItems.length === 0}
                      loading={submitLoading}
                      onSubmit={() => void submitOrder()}
                      showReadyHint={!selectedOrder}
                      showCashChange
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
