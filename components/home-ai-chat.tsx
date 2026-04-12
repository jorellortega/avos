"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MessageSquare, Send, Loader2 } from "lucide-react"
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
import type { AIMessage } from "@/lib/ai-types"

const MAX_MESSAGE_LEN = 8000

const INITIAL_ASSISTANT_MESSAGE: AIMessage = {
  role: "assistant",
  content:
    "¡Hola! Soy el asistente de Avos. Pregúntame sobre el menú, ingredientes o cómo ordenar.",
  timestamp: new Date().toISOString(),
}

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
  const [messages, setMessages] = useState<AIMessage[]>([
    INITIAL_ASSISTANT_MESSAGE,
  ])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending, scrollToBottom])

  const send = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return

    setError(null)
    setInput("")
    setIsSending(true)

    const userMessage: AIMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    const priorHistory = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(({ role, content }) => ({ role, content }))

    setMessages((prev) => [...prev, userMessage])

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: priorHistory,
        }),
      })
      const data = (await res.json()) as { message?: string; error?: string }

      if (!res.ok) {
        setMessages((prev) => prev.slice(0, -1))
        setInput(trimmed)
        setError(data.error ?? "No se pudo enviar el mensaje.")
        return
      }

      const text = data.message?.trim()
      if (!text) {
        setMessages((prev) => prev.slice(0, -1))
        setInput(trimmed)
        setError("Respuesta vacía del asistente.")
        return
      }

      const assistantMessage: AIMessage = {
        role: "assistant",
        content: text,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setMessages((prev) => prev.slice(0, -1))
      setInput(trimmed)
      setError("Error de red. Inténtalo de nuevo.")
    } finally {
      setIsSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <Card className="overflow-hidden border-primary/20 shadow-md">
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle
            className="text-lg md:text-xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Asistente Avos
          </CardTitle>
        </div>
        <CardDescription>
          Pregunta sobre el menú o tu pedido. Enter envía · Shift+Enter nueva
          línea.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div
          ref={scrollRef}
          className={cn(
            "max-h-[min(18rem,45vh)] overflow-y-auto rounded-lg border border-border/80 bg-muted/30 p-4 space-y-3",
            "scroll-smooth",
          )}
          role="log"
          aria-live="polite"
        >
          {messages.map((m, idx) => (
            <div
              key={`${m.timestamp ?? idx}-${idx}`}
              className={cn(
                "rounded-lg px-3 py-2 text-sm md:text-base",
                m.role === "user"
                  ? "ml-4 bg-primary text-primary-foreground"
                  : "mr-4 bg-card border border-border/60 text-foreground",
              )}
            >
              {renderMessageContent(m.content)}
            </div>
          ))}
          {isSending && (
            <div className="mr-4 flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              Pensando…
            </div>
          )}
        </div>

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
            placeholder="Escribe tu pregunta…"
            disabled={isSending}
            className="min-h-[3rem] sm:min-h-[2.75rem] resize-none flex-1"
            rows={2}
            maxLength={MAX_MESSAGE_LEN}
            aria-label="Mensaje para el asistente"
          />
          <Button
            type="button"
            onClick={() => void send()}
            disabled={isSending || !input.trim()}
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
