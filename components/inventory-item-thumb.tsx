"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, Package } from "lucide-react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { uploadToFilesBucket } from "@/lib/supabase-storage"
import { cn } from "@/lib/utils"

type Props = {
  itemId: string
  name: string
  imageUrl: string
  disabled?: boolean
  onImageUrl: (url: string) => void | Promise<void>
  /** sm = table row; lg = Empieza modal */
  size?: "sm" | "lg"
  className?: string
}

/** Small inventory thumbnail; tap to upload or replace photo. */
export function InventoryItemThumb({
  itemId,
  name,
  imageUrl,
  disabled,
  onImageUrl,
  size = "sm",
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [imgError, setImgError] = useState(false)
  const url = (imageUrl ?? "").trim()
  const showImage = Boolean(url) && !imgError
  const isLg = size === "lg"

  useEffect(() => {
    setImgError(false)
  }, [url])

  const pick = () => {
    if (!disabled && !busy) inputRef.current?.click()
  }

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) return

    setBusy(true)
    setImgError(false)
    try {
      const client = createBrowserSupabase()
      const publicUrl = await uploadToFilesBucket(
        client,
        file,
        `inventory/${itemId}`,
      )
      await onImageUrl(publicUrl)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={pick}
      disabled={disabled || busy}
      title={url ? "Cambiar foto" : "Añadir foto"}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-md border border-border bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled || busy
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:opacity-95",
        isLg ? "h-28 w-28 rounded-lg" : "h-10 w-10",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        onChange={(e) => void onChange(e)}
      />
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name || "Producto"}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Package className={isLg ? "size-12" : "size-4"} aria-hidden />
        </span>
      )}
      <span
        className={cn(
          "absolute inset-0 z-10 flex items-center justify-center bg-black/45 text-white transition-opacity",
          "pointer-events-none opacity-0 group-hover:opacity-100",
          busy && "opacity-100",
        )}
      >
        {busy ? (
          <Loader2 className={isLg ? "size-8 animate-spin" : "size-4 animate-spin"} />
        ) : (
          <ImagePlus className={isLg ? "size-8" : "size-4"} aria-hidden />
        )}
      </span>
    </button>
  )
}
