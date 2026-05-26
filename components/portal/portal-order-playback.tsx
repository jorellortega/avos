"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Square, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getPortalTtsCacheUrl,
  hasPortalTtsCache,
  putPortalTtsCache,
} from "@/lib/portal-tts-audio-cache"

type PortalOrderPlaybackProps = {
  text: string
  className?: string
  size?: "sm" | "default"
}

export function PortalOrderPlayback({
  text,
  className,
  size = "sm",
}: PortalOrderPlaybackProps) {
  const script = text.trim()
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [cached, setCached] = useState(() => hasPortalTtsCache(script))
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeUrlRef = useRef<string | null>(null)

  useEffect(() => {
    setCached(hasPortalTtsCache(script))
  }, [script])

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.onended = null
      audio.onerror = null
      audioRef.current = null
    }
    activeUrlRef.current = null
    setPlaying(false)
  }, [])

  useEffect(() => () => stopPlayback(), [stopPlayback])

  const playFromUrl = useCallback(
    async (url: string) => {
      stopPlayback()
      activeUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        stopPlayback()
        setLoading(false)
      }
      audio.onerror = () => {
        setError("No se pudo reproducir el audio.")
        stopPlayback()
        setLoading(false)
      }

      await audio.play()
      setPlaying(true)
      setLoading(false)
    },
    [stopPlayback],
  )

  const play = useCallback(async () => {
    if (!script || loading) return

    if (playing) {
      stopPlayback()
      setLoading(false)
      return
    }

    setError(null)
    setLoading(true)

    const cachedUrl = getPortalTtsCacheUrl(script)
    if (cachedUrl) {
      try {
        await playFromUrl(cachedUrl)
        setCached(true)
        return
      } catch {
        setError("No se pudo reproducir el audio en caché.")
        setLoading(false)
        return
      }
    }

    try {
      const res = await fetch("/api/portal/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          code?: string
          debug?: {
            blockReason?: string
            serviceRoleConfigured?: boolean
            rowsInDb?: { key: string; hasValue: boolean }[]
            hints?: string[]
          }
        }
        if (process.env.NODE_ENV === "development") {
          console.group("[portal TTS] error debug")
          console.log("code:", data.code)
          console.log("message:", data.error)
          if (data.debug) {
            console.log("blockReason:", data.debug.blockReason)
            console.log("serviceRole:", data.debug.serviceRoleConfigured)
            console.table(data.debug.rowsInDb)
            console.log("hints:", data.debug.hints)
          }
          console.groupEnd()
        }
        throw new Error(data.error ?? "No se pudo generar el audio.")
      }

      const blob = await res.blob()
      const url = putPortalTtsCache(script, blob)
      setCached(true)
      await playFromUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red.")
      stopPlayback()
      setLoading(false)
    }
  }, [script, loading, playing, stopPlayback, playFromUrl])

  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
  const btnClass = size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm"
  const label = loading
    ? cached
      ? "Cargando…"
      : "Generando…"
    : playing
      ? "Detener"
      : cached
        ? "Reproducir"
        : "Escuchar"

  return (
    <div className={cn("flex flex-col items-end gap-0.5", className)}>
      <Button
        type="button"
        variant="outline"
        size={size === "sm" ? "sm" : "default"}
        className={cn("gap-1.5 shrink-0", btnClass)}
        disabled={!script || loading}
        title={
          playing
            ? "Detener"
            : cached
              ? "Reproducir audio guardado (esta sesión)"
              : "Generar y escuchar pedido"
        }
        aria-label={playing ? "Detener reproducción del pedido" : label}
        onClick={() => void play()}
      >
        {loading ? (
          <Loader2 className={cn(iconClass, "animate-spin")} aria-hidden />
        ) : playing ? (
          <Square className={iconClass} aria-hidden />
        ) : (
          <Volume2 className={iconClass} aria-hidden />
        )}
        {label}
      </Button>
      {cached && !error && !loading && (
        <p className="text-[10px] text-muted-foreground text-right">
          Audio en caché
        </p>
      )}
      {error && (
        <p
          className="text-[10px] text-destructive max-w-[16rem] text-right leading-snug"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
