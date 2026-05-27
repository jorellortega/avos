"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { Bot, Loader2, Mic, Send, Square } from "lucide-react"
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
import type { OrderItem, OrderType } from "@/components/orders-provider"
import type { PortalDeliveryInfo } from "@/lib/portal-delivery"
import { portalItemsTotalWithDelivery } from "@/lib/portal-delivery"
import {
  buildPortalOrderLineBreakdown,
  orderItemsTotal,
  type PortalOrderLineBreakdown,
} from "@/lib/portal-menu-snapshot"
import { PortalAiOrderReply } from "@/components/portal/portal-ai-order-reply"
import type { PortalCartItemUpdate } from "@/lib/portal-cart-item"
import { resolvePortalOrderTipo } from "@/lib/portal-order-tipo"
import {
  startBrowserSpeechSession,
  type BrowserSpeechSession,
} from "@/lib/browser-speech-recognition"
import { portalShouldUseBrowserStt } from "@/lib/portal-stt-mode"

const PORTAL_STT_BROWSER_KEY = "portal_stt_use_browser"

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
  resetChat: () => void
  /** Scroll chat into view and show the order summary (e.g. side panel selection). */
  openOrder: (items: OrderItem[]) => void
}

type PortalAiChatProps = {
  existingItems: OrderItem[]
  nextOrderNumber: number
  orderNumero?: number
  orderTipo?: OrderType
  addMode?: boolean
  onItemsResolved: (items: OrderItem[], total: number, message: string) => void
  onOrderTipoChange?: (tipo: OrderType) => void
  delivery?: PortalDeliveryInfo
  needsDelivery?: boolean
  onDeliverySave?: (delivery: PortalDeliveryInfo) => void
  /** Total with envío when domicilio. */
  cartTotal?: number
  onUpdateItem?: (itemId: string, update: PortalCartItemUpdate) => void
  onDeleteItem?: (itemId: string) => void
  onRequestAddItem?: () => void
  disabled?: boolean
}

export const PortalAiChat = forwardRef<PortalAiChatHandle, PortalAiChatProps>(
  function PortalAiChat(
    {
      existingItems,
      nextOrderNumber,
      orderNumero,
      orderTipo = "mesa",
      addMode = false,
      onItemsResolved,
      onOrderTipoChange,
      delivery = {},
      needsDelivery = false,
      onDeliverySave,
      cartTotal,
      onUpdateItem,
      onDeleteItem,
      onRequestAddItem,
      disabled,
    },
    ref,
  ) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const skipCartSyncRef = useRef(true)

    const displayNum = orderNumero ?? nextOrderNumber
    const hasActiveCart = existingItems.length > 0
    const showAddHighlight = addMode && hasActiveCart

    const [itemFixItemId, setItemFixItemId] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const recordMimeRef = useRef("audio/webm")
    const browserSpeechRef = useRef<BrowserSpeechSession | null>(null)
    const preferBrowserSttRef = useRef(false)
    const [useBrowserStt, setUseBrowserStt] = useState(false)
    const voiceBusyRef = useRef({
      sending: false,
      transcribing: false,
      recording: false,
    })

    useEffect(() => {
      voiceBusyRef.current = {
        sending: isSending,
        transcribing: isTranscribing,
        recording: isRecording,
      }
    }, [isSending, isTranscribing, isRecording])

    useEffect(() => {
      try {
        const stored = sessionStorage.getItem(PORTAL_STT_BROWSER_KEY)
        const preferBrowser =
          stored === "1" || portalShouldUseBrowserStt(stored === "1")
        preferBrowserSttRef.current = preferBrowser
        setUseBrowserStt(preferBrowser)
        if (preferBrowser && stored !== "1") {
          sessionStorage.setItem(PORTAL_STT_BROWSER_KEY, "1")
        }
      } catch {
        const preferBrowser = portalShouldUseBrowserStt()
        preferBrowserSttRef.current = preferBrowser
        setUseBrowserStt(preferBrowser)
      }
    }, [])

    const scrollToBottom = useCallback(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }, [])

    const resetChat = useCallback(() => {
      skipCartSyncRef.current = true
      setMessages([])
      setInput("")
      setError(null)
      setItemFixItemId(null)
      setIsSending(false)
    }, [])

    const scrollChatIntoView = useCallback(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, [])

    const openOrder = useCallback(
      (items: OrderItem[]) => {
        scrollChatIntoView()
        if (items.length === 0) {
          resetChat()
          requestAnimationFrame(() => {
            inputRef.current?.focus()
          })
          return
        }
        skipCartSyncRef.current = true
        const lines = buildPortalOrderLineBreakdown(items)
        const total = orderItemsTotal(items)
        setMessages([
          { role: "assistant", content: "", orderReply: { lines, total } },
        ])
        setInput("")
        setError(null)
        setItemFixItemId(null)
        requestAnimationFrame(() => {
          inputRef.current?.focus()
          inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        })
      },
      [resetChat, scrollChatIntoView],
    )

    useImperativeHandle(
      ref,
      () => ({
        focusInput: () => {
          scrollChatIntoView()
          inputRef.current?.focus()
          inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        },
        openItemFixPicker: (itemId: string) => {
          const item = existingItems.find((i) => i.id === itemId)
          if (
            item?.needsProteina ||
            item?.needsBebidaTamano ||
            item?.needsBebidaEleccion
          ) {
            setItemFixItemId(itemId)
          }
        },
        resetChat,
        openOrder,
      }),
      [existingItems, resetChat, openOrder, scrollChatIntoView],
    )

    useEffect(() => {
      scrollToBottom()
    }, [messages, isSending, scrollToBottom])

    useEffect(() => {
      if (skipCartSyncRef.current) {
        skipCartSyncRef.current = false
        return
      }
      const lines = buildPortalOrderLineBreakdown(existingItems)
      const total =
        cartTotal ??
        portalItemsTotalWithDelivery(
          orderItemsTotal(existingItems),
          orderTipo,
          delivery,
        )
      setMessages((prev) =>
        prev.map((m) =>
          m.orderReply
            ? { ...m, orderReply: { ...m.orderReply, lines, total } }
            : m,
        ),
      )
    }, [existingItems, cartTotal, orderTipo, delivery])

    const lastOrderReplyIndex = (() => {
      let idx = -1
      messages.forEach((m, i) => {
        if (m.orderReply) idx = i
      })
      return idx
    })()

    const handleAiCustomize = async (
      itemId: string,
      instruction: string,
    ): Promise<{ notas: string } | { error: string }> => {
      const item = existingItems.find((i) => i.id === itemId)
      if (!item) return { error: "Artículo no encontrado." }

      try {
        const res = await fetch("/api/portal/ai-customize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item, instruction }),
        })
        const data = (await res.json()) as { notas?: string; error?: string }
        if (!res.ok) {
          return { error: data.error ?? "No se pudo personalizar." }
        }
        if (!data.notas?.trim()) {
          return { error: "La IA no devolvió notas." }
        }
        onUpdateItem?.(itemId, { notas: data.notas, cantidad: item.cantidad })
        return { notas: data.notas }
      } catch {
        return { error: "Error de red." }
      }
    }

    const stopMediaTracks = useCallback(() => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
    }, [])

    useEffect(() => {
      return () => {
        browserSpeechRef.current?.stop()
        browserSpeechRef.current = null
        stopMediaTracks()
      }
    }, [stopMediaTracks])

    const send = async (
      messageOverride?: string,
      opts?: { fromVoice?: boolean },
    ) => {
      const trimmed = (messageOverride ?? input).trim()
      const busy = voiceBusyRef.current
      if (
        !trimmed ||
        isSending ||
        disabled ||
        (!opts?.fromVoice && (isTranscribing || busy.transcribing))
      ) {
        return
      }

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
            orderTipo,
          }),
        })
        const data = (await res.json()) as {
          items?: OrderItem[]
          total?: number
          lineBreakdown?: PortalOrderLineBreakdown[]
          assistantMessage?: string
          orderTipo?: OrderType
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
        const itemsTotal = data.total ?? orderItemsTotal(items)
        const lines = data.lineBreakdown ?? []
        const warnings = data.warnings?.length ? data.warnings.join("; ") : undefined
        const replyTotal = portalItemsTotalWithDelivery(
          itemsTotal,
          orderTipo,
          delivery,
        )
        const orderReply = { lines, total: replyTotal, warnings }

        const resolvedTipo = resolvePortalOrderTipo(
          trimmed,
          data.orderTipo,
          orderTipo,
        )
        if (onOrderTipoChange && resolvedTipo !== orderTipo) {
          onOrderTipoChange(resolvedTipo)
        }

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
        onItemsResolved(items, replyTotal, "")
      } catch {
        setMessages((prev) => prev.slice(0, -1))
        setInput(trimmed)
        setError("Error de red.")
      } finally {
        setIsSending(false)
      }
    }

    const enableBrowserStt = useCallback(() => {
      preferBrowserSttRef.current = true
      setUseBrowserStt(true)
      try {
        sessionStorage.setItem(PORTAL_STT_BROWSER_KEY, "1")
      } catch {
        /* ignore */
      }
    }, [])

    const stopBrowserDictation = useCallback(() => {
      browserSpeechRef.current?.stop()
    }, [])

    const startBrowserDictation = async (opts?: { force?: boolean }) => {
      const busy = voiceBusyRef.current
      if (
        !opts?.force &&
        (busy.sending || busy.transcribing || busy.recording || disabled)
      ) {
        return
      }
      setError(null)
      setIsRecording(true)
      voiceBusyRef.current = { ...voiceBusyRef.current, recording: true }

      const session = startBrowserSpeechSession()
      browserSpeechRef.current = session

      try {
        const text = await session.done
        await send(text, { fromVoice: true })
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo dictar el pedido.",
        )
      } finally {
        browserSpeechRef.current = null
        setIsRecording(false)
        voiceBusyRef.current = { ...voiceBusyRef.current, recording: false }
      }
    }

    const transcribeAndSend = async (audio: Blob) => {
      setIsTranscribing(true)
      voiceBusyRef.current = { ...voiceBusyRef.current, transcribing: true }
      setError(null)
      try {
        const form = new FormData()
        const ext = recordMimeRef.current.includes("mp4") ? "m4a" : "webm"
        form.append("file", audio, `pedido.${ext}`)

        const res = await fetch("/api/portal/speech-to-text", {
          method: "POST",
          body: form,
        })
        const data = (await res.json()) as {
          text?: string
          error?: string
          code?: string
          fallback?: string
        }
        if (!res.ok) {
          if (
            data.code === "missing_stt_permission" &&
            data.fallback === "browser"
          ) {
            enableBrowserStt()
            setIsTranscribing(false)
            voiceBusyRef.current = {
              ...voiceBusyRef.current,
              transcribing: false,
            }
            await startBrowserDictation({ force: true })
            return
          }
          setError(data.error ?? "No se pudo transcribir el audio.")
          return
        }
        const text = data.text?.trim()
        if (!text) {
          setError("No se detectó texto en el audio.")
          return
        }
        await send(text, { fromVoice: true })
      } catch {
        setError("Error de red al transcribir.")
      } finally {
        setIsTranscribing(false)
        voiceBusyRef.current = { ...voiceBusyRef.current, transcribing: false }
      }
    }

    const stopRecording = useCallback(() => {
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== "inactive") {
        recorder.stop()
      }
      setIsRecording(false)
      voiceBusyRef.current = { ...voiceBusyRef.current, recording: false }
    }, [])

    const handleMicClick = () => {
      if (isRecording) {
        if (useBrowserStt) stopBrowserDictation()
        else stopRecording()
        return
      }
      void startRecording()
    }

    const startRecording = async () => {
      const busy = voiceBusyRef.current
      if (busy.sending || disabled || busy.transcribing || busy.recording) {
        return
      }
      setError(null)

      if (portalShouldUseBrowserStt(preferBrowserSttRef.current)) {
        await startBrowserDictation({ force: true })
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Tu navegador no permite grabar audio.")
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream
        audioChunksRef.current = []

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : ""
        recordMimeRef.current = mimeType || "audio/webm"

        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream)
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        recorder.onerror = () => {
          setError("Error al grabar audio.")
          stopRecording()
          stopMediaTracks()
        }
        recorder.onstop = () => {
          stopMediaTracks()
          const blob = new Blob(audioChunksRef.current, {
            type: recordMimeRef.current,
          })
          audioChunksRef.current = []
          if (blob.size > 0) {
            void transcribeAndSend(blob)
          } else {
            setError("No se capturó audio. Intenta de nuevo.")
          }
        }

        recorder.start()
        setIsRecording(true)
      } catch (e) {
        stopMediaTracks()
        const name = e instanceof DOMException ? e.name : ""
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError("Permite el micrófono para dictar el pedido.")
        } else {
          setError("No se pudo iniciar la grabación.")
        }
      }
    }

    const voiceBusy = isRecording || isTranscribing
    const hasOrderReply = messages.some((m) => m.orderReply)
    const showMessageLog =
      messages.length > 0 || isSending || isTranscribing || isRecording

    return (
      <div ref={cardRef} className="scroll-mt-4">
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
                    Escribe o usa el micrófono · La IA arma el carrito · Orden #
                    {displayNum}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          {showMessageLog ? (
            <div
              ref={scrollRef}
              className={cn(
                "rounded-md border bg-muted/40 p-3 space-y-2 text-sm",
                hasOrderReply
                  ? "overflow-visible"
                  : "max-h-36 overflow-y-auto",
              )}
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
                      orderNumero={displayNum}
                      warnings={m.orderReply.warnings}
                      onUpdateItem={onUpdateItem}
                      onDeleteItem={onDeleteItem}
                      onAiCustomize={
                        onUpdateItem ? handleAiCustomize : undefined
                      }
                      onAddItem={
                        i === lastOrderReplyIndex && hasActiveCart
                          ? onRequestAddItem
                          : undefined
                      }
                      itemFixItemId={
                        i === lastOrderReplyIndex ? itemFixItemId : null
                      }
                      onItemFixHandled={() => setItemFixItemId(null)}
                      orderTipo={orderTipo}
                      onOrderTipoChange={
                        i === lastOrderReplyIndex ? onOrderTipoChange : undefined
                      }
                      delivery={delivery}
                      needsDelivery={
                        i === lastOrderReplyIndex ? needsDelivery : false
                      }
                      onDeliverySave={
                        i === lastOrderReplyIndex ? onDeliverySave : undefined
                      }
                    />
                  ) : (
                    <span className="whitespace-pre-wrap text-sm">
                      {m.content}
                    </span>
                  )}
                </div>
              ))}
              {(isSending || isTranscribing) && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {isTranscribing ? "Transcribiendo…" : "Calculando…"}
                </div>
              )}
              {isRecording && (
                <div className="flex items-center gap-2 text-destructive text-xs font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                  </span>
                  Escuchando… toca el micrófono para enviar
                </div>
              )}
            </div>
          ) : null}
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
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
              disabled={isSending || disabled || voiceBusy}
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
              variant={isRecording ? "destructive" : "outline"}
              className="shrink-0 self-end"
              disabled={isSending || disabled || isTranscribing}
              title={
                isRecording ? "Detener y enviar pedido" : "Dictar pedido con voz"
              }
              aria-label={
                isRecording ? "Detener y enviar pedido" : "Dictar pedido con voz"
              }
              onClick={handleMicClick}
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              className={cn(
                "shrink-0 self-end",
                showAddHighlight && "bg-green-600 hover:bg-green-700 text-white",
              )}
              disabled={isSending || !input.trim() || disabled || voiceBusy}
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
      </div>
    )
  },
)
