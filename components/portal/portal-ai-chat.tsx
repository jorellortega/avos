"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { Bot, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { OrderItem } from "@/components/orders-provider"
import {
  buildPortalOrderLineBreakdown,
  orderItemsTotal,
  type PortalOrderLineBreakdown,
} from "@/lib/portal-menu-snapshot"
import { PortalAiOrderReply } from "@/components/portal/portal-ai-order-reply"
import type { PortalCartItemUpdate } from "@/lib/portal-cart-item"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  orderReply?: {
    lines: PortalOrderLineBreakdown[]
    total: number
    warnings?: string
  }
}

export type PortalAiChatHandle = {
  focusInput: () => void
  openItemFixPicker: (itemId: string) => void
}

type PortalAiChatProps = {
  existingItems: OrderItem[]
  nextOrderNumber: number
  orderNumero?: number
  addMode?: boolean
  onItemsResolved: (items: OrderItem[], total: number, message: string) => void
  onUpdateItem?: (itemId: string, update: PortalCartItemUpdate) => void
  onDeleteItem?: (itemId: string) => void
  onRequestAddItem?: () => void
  disabled?: boolean
}

const INITIAL: ChatMessage = {
  role: "assistant",
  content:
    'Escribe el pedido en español o inglés. Ej: "2 tacos asada sin salsa, agua chica, burrito pastor".',
}

export const PortalAiChat = forwardRef<PortalAiChatHandle, PortalAiChatProps>(
  function PortalAiChat(
    {
      existingItems,
      nextOrderNumber,
      orderNumero,
      addMode = false,
      onItemsResolved,
      onUpdateItem,
      onDeleteItem,
      onRequestAddItem,
      disabled,
    },
    ref,
  ) {
    const [messages, setMessages] = useState<ChatMessage[]>([INITIAL])
    const [input, setInput] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const skipCartSyncRef = useRef(true)

    const displayNum = orderNumero ?? nextOrderNumber
    const hasActiveCart = existingItems.length > 0
    const showAddHighlight = addMode && hasActiveCart

    const [itemFixItemId, setItemFixItemId] = useState<string | null>(null)

    useImperativeHandle(
      ref,
      () => ({
        focusInput: () => {
          inputRef.current?.focus()
          inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        },
        openItemFixPicker: (itemId: string) => {
          const item = existingItems.find((i) => i.id === itemId)
          if (item?.needsProteina || item?.needsBebidaTamano) {
            setItemFixItemId(itemId)
          }
        },
      }),
      [existingItems],
    )

    const scrollToBottom = useCallback(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }, [])

    useEffect(() => {
      scrollToBottom()
    }, [messages, isSending, scrollToBottom])

    useEffect(() => {
      if (skipCartSyncRef.current) {
        skipCartSyncRef.current = false
        return
      }
      const lines = buildPortalOrderLineBreakdown(existingItems)
      const total = orderItemsTotal(existingItems)
      setMessages((prev) =>
        prev.map((m) =>
          m.orderReply
            ? { ...m, orderReply: { ...m.orderReply, lines, total } }
            : m,
        ),
      )
    }, [existingItems])

    const lastOrderReplyIndex = (() => {
      let idx = -1
      messages.forEach((m, i) => {
        if (m.orderReply) idx = i
      })
      return idx
    })()

    const send = async () => {
      const trimmed = input.trim()
      if (!trimmed || isSending || disabled) return

      setError(null)
      setInput("")
      setIsSending(true)
      setMessages((prev) => [...prev, { role: "user", content: trimmed }])

      try {
        const res = await fetch("/api/portal/ai-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            existingItems,
            nextOrderNumber:
              hasActiveCart || orderNumero != null ? undefined : nextOrderNumber,
            orderNumero: hasActiveCart ? displayNum : orderNumero,
            forceAppend: hasActiveCart,
          }),
        })
        const data = (await res.json()) as {
          items?: OrderItem[]
          total?: number
          lineBreakdown?: PortalOrderLineBreakdown[]
          assistantMessage?: string
          error?: string
          warnings?: string[]
        }

        if (!res.ok) {
          setMessages((prev) => prev.slice(0, -1))
          setInput(trimmed)
          setError(data.error ?? "No se pudo procesar el pedido.")
          return
        }

        const items = data.items ?? []
        const total = data.total ?? 0
        const lines = data.lineBreakdown ?? []
        const warnings = data.warnings?.length ? data.warnings.join("; ") : undefined
        const orderReply = { lines, total, warnings }

        setMessages((prev) => {
          let lastReplyIdx = -1
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].orderReply) {
              lastReplyIdx = i
              break
            }
          }
          // Append to current order: refresh the single summary card, don't stack duplicates
          if (existingItems.length > 0 && lastReplyIdx >= 0) {
            return prev.map((m, i) =>
              i === lastReplyIdx ? { ...m, orderReply } : m,
            )
          }
          return [
            ...prev,
            { role: "assistant", content: "", orderReply },
          ]
        })
        onItemsResolved(items, total, "")
      } catch {
        setMessages((prev) => prev.slice(0, -1))
        setInput(trimmed)
        setError("Error de red.")
      } finally {
        setIsSending(false)
      }
    }

    return (
      <Card
        className={cn(
          "shadow-sm transition-colors",
          showAddHighlight
            ? "border-green-500 ring-2 ring-green-500/25"
            : "border-primary/25",
        )}
      >
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Bot
              className={cn(
                "h-5 w-5 shrink-0",
                showAddHighlight ? "text-green-600" : "text-primary",
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <CardTitle
                className="text-base"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Pedido por voz / texto
              </CardTitle>
              <CardDescription className="text-xs">
                {showAddHighlight ? (
                  <span className="text-green-700 dark:text-green-400 font-medium">
                    Agregando a orden #{displayNum} — escribe más artículos
                  </span>
                ) : (
                  <>
                    La IA arma el carrito y calcula el total · Orden #{displayNum}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          <div
            ref={scrollRef}
            className="max-h-36 overflow-y-auto rounded-md border bg-muted/40 p-3 space-y-2 text-sm"
            role="log"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 break-words",
                  m.role === "user"
                    ? "ml-6 bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "mr-6 bg-card border text-foreground",
                )}
              >
                {m.orderReply ? (
                <PortalAiOrderReply
                  lines={m.orderReply.lines}
                  total={m.orderReply.total}
                  warnings={m.orderReply.warnings}
                  onUpdateItem={onUpdateItem}
                  onDeleteItem={onDeleteItem}
                  onAddItem={
                    i === lastOrderReplyIndex && hasActiveCart
                      ? onRequestAddItem
                      : undefined
                  }
                  itemFixItemId={i === lastOrderReplyIndex ? itemFixItemId : null}
                  onItemFixHandled={() => setItemFixItemId(null)}
                />
                ) : (
                  <span className="whitespace-pre-wrap text-sm">{m.content}</span>
                )}
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Calculando…
              </div>
            )}
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder={
                showAddHighlight
                  ? `Agregar a orden #${displayNum}…`
                  : hasActiveCart
                    ? `Más para orden #${displayNum}…`
                    : `Nueva orden #${nextOrderNumber}…`
              }
              disabled={isSending || disabled}
              className={cn(
                "min-h-[2.5rem] resize-none flex-1 text-sm transition-colors",
                showAddHighlight &&
                  "border-green-500 bg-green-50 focus-visible:ring-green-500/40 dark:bg-green-950/30 dark:border-green-600",
              )}
              rows={2}
            />
            <Button
              type="button"
              size="icon"
              className={cn(
                "shrink-0 self-end",
                showAddHighlight && "bg-green-600 hover:bg-green-700 text-white",
              )}
              disabled={isSending || !input.trim() || disabled}
              onClick={() => void send()}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  },
)
