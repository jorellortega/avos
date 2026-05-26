"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type ElevenLabsVoiceOption = {
  voice_id: string
  name: string
  category?: string
}

type ElevenLabsVoicePickerProps = {
  apiKey: string
  voiceId: string
  onVoiceChange: (voiceId: string) => void
  /** Preset / dropdown selection — save immediately */
  onVoiceSelect?: (voiceId: string) => void
  description?: string | null
}

export function ElevenLabsVoicePicker({
  apiKey,
  voiceId,
  onVoiceChange,
  onVoiceSelect,
  description,
}: ElevenLabsVoicePickerProps) {
  const [voices, setVoices] = useState<ElevenLabsVoiceOption[]>([])
  const [presets, setPresets] = useState<ElevenLabsVoiceOption[]>([])
  const [manualMode, setManualMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadVoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const key = apiKey.trim()
      const res = await fetch("/api/ai-settings/elevenlabs-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key ? { apiKey: key } : {}),
      })
      const data = (await res.json()) as {
        voices?: ElevenLabsVoiceOption[]
        presets?: ElevenLabsVoiceOption[]
        error?: string
        code?: string
      }
      if (!res.ok) {
        if (data.code === "missing_voices_read_permission" && data.presets?.length) {
          setPresets(data.presets)
          setVoices([])
          setManualMode(true)
          setError(data.error ?? null)
          return
        }
        throw new Error(data.error ?? "No se pudieron cargar las voces.")
      }
      setPresets([])
      setManualMode(false)
      setVoices(data.voices ?? [])
      if ((data.voices ?? []).length === 0) {
        setError("No hay voces en tu cuenta de ElevenLabs.")
        setManualMode(true)
      }
    } catch (e) {
      setVoices([])
      setError(e instanceof Error ? e.message : "Error de red.")
      setManualMode(true)
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    if (!apiKey.trim()) return
    const t = window.setTimeout(() => void loadVoices(), 400)
    return () => window.clearTimeout(t)
    // Only refetch when API key changes; presets work without voices_read
  }, [apiKey, loadVoices])

  const listVoices = voices.length > 0 ? voices : presets
  const selected = listVoices.find((v) => v.voice_id === voiceId)
  const showDropdown = listVoices.length > 0 && !manualMode
  const selectValue = voiceId && (selected || voiceId) ? voiceId : undefined

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="elevenlabs_voice_id">Voz (TTS)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={loading}
          onClick={() => void loadVoices()}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Actualizar voces
        </Button>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {showDropdown ? (
        <Select
          value={selectValue}
          onValueChange={(id) => {
            onVoiceChange(id)
            onVoiceSelect?.(id)
          }}
          disabled={loading}
        >
          <SelectTrigger id="elevenlabs_voice_id" className="w-full max-w-md">
            <SelectValue
              placeholder={loading ? "Cargando voces…" : "Elige una voz"}
            />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {voiceId && !selected && (
              <SelectItem value={voiceId}>{voiceId} (guardada)</SelectItem>
            )}
            {listVoices.map((v) => (
              <SelectItem key={v.voice_id} value={v.voice_id}>
                {v.name}
                {v.category ? ` · ${v.category}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="space-y-2 max-w-md">
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((v) => (
                <Button
                  key={v.voice_id}
                  type="button"
                  size="sm"
                  variant={voiceId === v.voice_id ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => {
                    onVoiceChange(v.voice_id)
                    onVoiceSelect?.(v.voice_id)
                  }}
                >
                  {v.name}
                </Button>
              ))}
            </div>
          )}
          <Input
            id="elevenlabs_voice_id"
            value={voiceId}
            onChange={(e) => onVoiceChange(e.target.value.trim())}
            placeholder="Pega el voice ID (elevenlabs.io → Voices)"
            className="font-mono text-sm"
            autoComplete="off"
          />
        </div>
      )}

      {listVoices.length > 0 && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setManualMode((m) => !m)}
        >
          {manualMode ? "Usar lista de voces" : "Pegar ID de voz manualmente"}
        </button>
      )}

      {voiceId && (
        <p className="text-[10px] text-muted-foreground font-mono truncate max-w-md">
          ID: {voiceId}
        </p>
      )}
      {error && (
        <p
          className={cn(
            "text-xs",
            presets.length > 0 ? "text-amber-700 dark:text-amber-400" : "text-destructive",
          )}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
