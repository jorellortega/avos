"use client"

import { useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { uploadToFilesBucket } from "@/lib/supabase-storage"

type Props = {
  /** Path prefix inside bucket `files`, e.g. `site/hero` */
  folderPath: string
  onUploaded: (publicUrl: string) => void
  disabled?: boolean
}

export function StorageUploadButton({ folderPath, onUploaded, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const pick = () => inputRef.current?.click()

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setErr("Elige un archivo de imagen.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr("Máximo 10 MB.")
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const client = createBrowserSupabase()
      const url = await uploadToFilesBucket(client, file, folderPath)
      onUploaded(url)
    } catch (e) {
      console.error(e)
      setErr(
        e instanceof Error ? e.message : "No se pudo subir. ¿Políticas del bucket?",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        onChange={(e) => void onChange(e)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled || busy}
        onClick={pick}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        <span className="ml-2">Subir (bucket files)</span>
      </Button>
      {err && (
        <p className="text-xs text-destructive max-w-md" role="alert">
          {err}
        </p>
      )}
    </div>
  )
}
