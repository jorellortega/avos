"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, MessageSquare, Send, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useOrders, type OrderItem, type OrderType } from "@/components/orders-provider"
import { PortalAiOrderReply } from "@/components/portal/portal-ai-order-reply"
import {
  buildPortalOrderLineBreakdown,
  orderItemsTotal,
  type PortalOrderLineBreakdown,
} from "@/lib/portal-menu-snapshot"
import { PortalOrderTipoDelivery } from "@/components/portal/portal-order-tipo-delivery"
import { resolvePortalOrderTipo } from "@/lib/portal-order-tipo"
import {
  portalDeliveryForTipo,
  portalOrderNeedsDeliveryInfo,
  portalOrderTotal,
  type PortalDeliveryInfo,
} from "@/lib/portal-delivery"
import { insertAvosOrderToSupabase } from "@/lib/avos-orders-sync"
import { logCheckoutClient } from "@/lib/checkout-debug-client"

const MAX_MESSAGE_LEN = 4000

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  orderReply?: {
    lines: PortalOrderLineBreakdown[]
    total: number
    warnings?: string
  }
}

const INITIAL_ASSISTANT_MESSAGE =
  "¡Hola! Puedes pedir aquí con texto natural — por ejemplo: «2 tacos y una torta». Elige Aquí, Llevar o Domicilio cuando tengas artículos en el carrito. Si falta proteína o tamaño, te preguntaré antes de mostrar el total."

function renderMessageContent(text: string) {
  const stripped = text.replace(/\*\*(.*?)\*\*/g, "$1")
  const lines = stripped.split("\n")
  return lines.map((line, lineIdx) => (
    <span key={lineIdx} className="block whitespace-pre-wrap break-words">
      {lineIdx > 0 ? "\n" : null}
      {line.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 break-all"
            >
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  ))
}

export function HomeAiChat() {
  const router = useRouter()
  const { addOrder } = useOrders()
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: INITIAL_ASSISTANT_MESSAGE },
  ])
  const [cartItems, setCartItems] = useState<OrderItem[]>([])
  const [orderTipo, setOrderTipo] = useState<OrderType>("pickup")
  const [delivery, setDelivery] = useState<PortalDeliveryInfo>({})
  const [customerName, setCustomerName] = useState("")
  const [tableNumber, setTableNumber] = useState("")
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [placeOrderLoading, setPlaceOrderLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderingEnabled, setOrderingEnabled] = useState(true)
  const [orderingMessage, setOrderingMessage] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/ordering-status")
        const data = (await res.json()) as { enabled?: boolean; message?: string }
        setOrderingEnabled(data.enabled !== false)
        setOrderingMessage(data.message ?? "")
      } catch {
        setOrderingEnabled(true)
      }
    })()
  }, [])

  const itemsSubtotal = useMemo(() => orderItemsTotal(cartItems), [cartItems])
  const cartTotal = useMemo(
    () => portalOrderTotal(itemsSubtotal, orderTipo, delivery),
    [itemsSubtotal, orderTipo, delivery],
  )
  const needsDelivery = portalOrderNeedsDeliveryInfo(orderTipo, delivery)

  const handleOrderTipoChange = useCallback((tipo: OrderType) => {
    setOrderTipo(tipo)
    setDelivery((prev) => portalDeliveryForTipo(tipo, prev))
  }, [])

  const handleDeliverySave = useCallback((info: PortalDeliveryInfo) => {
    setDelivery(info)
  }, [])

  const handleDeliveryFeeChange = useCallback((fee: number) => {
    setDelivery((prev) => ({ ...prev, deliveryFee: fee }))
  }, [])
  const cartLines = useMemo(
    () => buildPortalOrderLineBreakdown(cartItems),
    [cartItems],
  )
  const cartIncomplete = cartLines.some(
    (l) =>
      l.needsProteina ||
      l.needsPlatilloTamano ||
      l.needsBebidaTamano ||
      l.needsBebidaEleccion,
  )

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending, cartItems, scrollToBottom])

  const send = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return

    setError(null)
    setInput("")
    setIsSending(true)
    setMessages((prev) => [...prev, { role: "user", content: trimmed }])

    try {
      const res = await fetch("/api/public/ai-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          existingItems: cartItems,
          orderTipo,
        }),
      })
      const data = (await res.json()) as {
        items?: OrderItem[]
        total?: number
        lineBreakdown?: PortalOrderLineBreakdown[]
        assistantMessage?: string
        orderTipo?: OrderType
        conversational?: boolean
        incomplete?: boolean
        error?: string
        warnings?: string[]
      }

      if (!res.ok) {
        setMessages((prev) => prev.slice(0, -1))
        setInput(trimmed)
        setError(data.error ?? "No se pudo procesar el mensaje.")
        return
      }

      const items = data.items ?? cartItems
      const resolvedTipo = resolvePortalOrderTipo(
        trimmed,
        data.orderTipo,
        orderTipo,
      )
      if (resolvedTipo !== orderTipo) {
        handleOrderTipoChange(resolvedTipo)
      }
      const activeDelivery = portalDeliveryForTipo(resolvedTipo, delivery)
      const total = portalOrderTotal(
        data.total ?? orderItemsTotal(items),
        resolvedTipo,
        activeDelivery,
      )
      const lines = data.lineBreakdown ?? buildPortalOrderLineBreakdown(items)
      const warnings = data.warnings?.length ? data.warnings.join("; ") : undefined
      const assistantText = data.assistantMessage?.trim() ?? ""

      if (!data.conversational && items.length > 0) {
        setCartItems(items)
      }

      setMessages((prev) => {
        let next = [...prev]
        if (assistantText && data.conversational) {
          next.push({ role: "assistant", content: assistantText })
        }
        if (!data.conversational && items.length > 0) {
          const orderReply = { lines, total, warnings }
          let lastReplyIdx = -1
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].orderReply) {
              lastReplyIdx = i
              break
            }
          }
          const replyMessage = {
            role: "assistant" as const,
            content: assistantText,
            orderReply,
          }
          if (lastReplyIdx >= 0) {
            next = next.map((m, i) =>
              i === lastReplyIdx ? replyMessage : m,
            )
          } else {
            next.push(replyMessage)
          }
        }
        return next
      })
    } catch {
      setMessages((prev) => prev.slice(0, -1))
      setInput(trimmed)
      setError("Error de red. Inténtalo de nuevo.")
    } finally {
      setIsSending(false)
    }
  }

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || cartIncomplete) return
    const name = customerName.trim()
    if (!name) {
      setError("Escribe tu nombre para confirmar el pedido.")
      return
    }
    if (orderTipo === "mesa" && !tableNumber.trim()) {
      setError("Indica tu número de mesa.")
      return
    }
    if (needsDelivery) {
      setError("Para domicilio, elige zona y dirección de entrega.")
      return
    }
    if (!orderingEnabled) {
      setError(
        orderingMessage.trim() ||
          "En este momento no estamos aceptando pedidos en línea.",
      )
      return
    }

    setPlaceOrderLoading(true)
    setError(null)

    const newOrder = addOrder({
      items: cartItems,
      nombreCliente: name,
      mesa: orderTipo === "mesa" ? tableNumber.trim() : undefined,
      tipo: orderTipo,
      status: "pendiente",
      total: cartTotal,
      ...(orderTipo === "domicilio"
        ? {
            deliveryZoneId: delivery.deliveryZoneId,
            deliveryZoneLabel: delivery.deliveryZoneLabel,
            deliveryFee: delivery.deliveryFee,
            deliveryAddress: delivery.deliveryAddress,
          }
        : {}),
    })

    const inserted = await insertAvosOrderToSupabase(newOrder)
    if (!inserted) {
      setPlaceOrderLoading(false)
      setError(
        orderingMessage.trim() ||
          "No se pudo registrar el pedido. Intenta de nuevo o usa el menú completo.",
      )
      return
    }

    if (orderTipo === "pickup") {
      try {
        logCheckoutClient("home-chat:pickup:checkout_order", {
          orderIdPrefix: newOrder.id.slice(0, 8),
          numero: newOrder.numero,
          total: newOrder.total,
        })
        const res = await fetch("/api/checkout/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: newOrder.id }),
        })
        const data = (await res.json()) as { url?: string; error?: string }
        if (!res.ok || !data.url) {
          setPlaceOrderLoading(false)
          setError(data.error ?? "No se pudo iniciar el pago.")
          return
        }
        window.location.href = data.url
        return
      } catch {
        setPlaceOrderLoading(false)
        setError("Error de red al iniciar el pago.")
        return
      }
    }

    setPlaceOrderLoading(false)
    router.push(`/orden/${newOrder.numero}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const hasCart = cartItems.length > 0

  return (
    <Card className="overflow-hidden border-primary/20 shadow-md">
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle
            className="text-lg md:text-xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Ordena con el asistente
          </CardTitle>
        </div>
        <CardDescription>
          Pide en texto natural con el menú completo, o{" "}
          <Link href="/ordenar" className="text-primary underline underline-offset-2">
            abre el menú visual
          </Link>
          . Enter envía · Shift+Enter nueva línea.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div
          ref={scrollRef}
          className={cn(
            "overflow-y-auto rounded-lg border border-border/80 bg-muted/30 p-4 space-y-3 scroll-smooth",
            hasCart ? "max-h-[min(28rem,55vh)]" : "max-h-[min(18rem,45vh)]",
          )}
          role="log"
          aria-live="polite"
        >
          {messages.map((m, idx) => (
            <div key={`${idx}-${m.role}`}>
              {m.orderReply ? (
                <div className="mr-4 space-y-2">
                  {m.content ? (
                    <div className="rounded-lg px-3 py-2 text-sm md:text-base mr-0 bg-card border border-border/60 text-foreground">
                      {renderMessageContent(m.content)}
                    </div>
                  ) : null}
                  <PortalAiOrderReply
                    lines={m.orderReply.lines}
                    total={m.orderReply.total}
                    warnings={m.orderReply.warnings}
                    orderTipo={orderTipo}
                    onOrderTipoChange={handleOrderTipoChange}
                    delivery={delivery}
                  />
                </div>
              ) : m.content ? (
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm md:text-base",
                    m.role === "user"
                      ? "ml-4 bg-primary text-primary-foreground"
                      : "mr-4 bg-card border border-border/60 text-foreground",
                  )}
                >
                  {renderMessageContent(m.content)}
                </div>
              ) : null}
            </div>
          ))}
          {isSending && (
            <div className="mr-4 flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              Procesando…
            </div>
          )}
        </div>

        {hasCart ? (
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-medium">Confirmar pedido</p>
            <PortalOrderTipoDelivery
              orderTipo={orderTipo}
              onOrderTipoChange={handleOrderTipoChange}
              delivery={delivery}
              needsDelivery={needsDelivery}
              onDeliverySave={handleDeliverySave}
              onDeliveryFeeChange={handleDeliveryFeeChange}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="home-chat-name">Tu nombre</Label>
                <Input
                  id="home-chat-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre para el pedido"
                  disabled={placeOrderLoading}
                />
              </div>
              {orderTipo === "mesa" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="home-chat-mesa">Mesa</Label>
                  <Input
                    id="home-chat-mesa"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Ej. 12"
                    disabled={placeOrderLoading}
                  />
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={
                placeOrderLoading ||
                cartIncomplete ||
                !orderingEnabled ||
                needsDelivery
              }
              onClick={() => void handlePlaceOrder()}
            >
              {placeOrderLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ShoppingBag className="h-4 w-4 mr-2" />
              )}
              {orderTipo === "pickup"
                ? "Confirmar y pagar"
                : orderTipo === "mesa"
                  ? "Confirmar pedido en mesa"
                  : "Confirmar pedido a domicilio"}
            </Button>
            {cartIncomplete ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Responde en el chat con proteína o tamaño (ej. «tacos asada, torta
                pastor»).
              </p>
            ) : null}
          </div>
        ) : null}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ej. 2 tacos pastor, burrito asada y horchata grande…"
            disabled={isSending || placeOrderLoading}
            className="min-h-[3rem] sm:min-h-[2.75rem] resize-none flex-1"
            rows={2}
            maxLength={MAX_MESSAGE_LEN}
            aria-label="Mensaje para ordenar o preguntar"
          />
          <Button
            type="button"
            onClick={() => void send()}
            disabled={isSending || placeOrderLoading || !input.trim()}
            className="sm:self-end shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-2">Enviar</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
