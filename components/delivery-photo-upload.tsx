"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Camera, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { uploadToFilesBucket } from "@/lib/supabase-storage"
import { cn } from "@/lib/utils"

type Props = {
  id: string
  label: string
  hint: string
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
}

export function DeliveryPhotoUpload({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const pick = () => inputRef.current?.click()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setErr("Elige una foto (imagen).")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setErr("Máximo 8 MB por foto.")
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const client = createBrowserSupabase()
      const url = await uploadToFilesBucket(client, file, "delivery-photos")
      onChange(url)
    } catch (uploadErr) {
      console.error(uploadErr)
      setErr(
        uploadErr instanceof Error
          ? uploadErr.message
          : "No se pudo subir la foto. Intenta de nuevo.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label} <span className="text-destructive">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => void onFile(e)}
      />
      {value ? (
        <div className="relative rounded-lg border border-border overflow-hidden bg-muted aspect-[4/3] max-h-48">
          <Image
            src={value}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw"
            unoptimized
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 rounded-full shadow"
            disabled={disabled || busy}
            onClick={() => onChange(null)}
            aria-label="Quitar foto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={pick}
          className={cn(
            "w-full rounded-lg border-2 border-dashed border-border bg-muted/30 aspect-[4/3] max-h-48",
            "flex flex-col items-center justify-center gap-2 transition-colors",
            "hover:border-primary/50 hover:bg-accent/30 touch-manipulation",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {busy ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Camera className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-muted-foreground">
            {busy ? "Subiendo…" : "Tomar o elegir foto"}
          </span>
        </button>
      )}
      {!value && !busy ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={disabled}
          onClick={pick}
        >
          Subir foto
        </Button>
      ) : null}
      {err ? (
        <p className="text-xs text-destructive" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  )
}
