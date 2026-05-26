"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Brain, Camera, ImagePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  patchesFromInventoryScan,
  inventoryScanSummary,
  type InventoryScanResult,
} from "@/lib/inventory-ai-scan"
import type { InventoryItemRow } from "@/lib/inventario-types"
import { cn } from "@/lib/utils"

type Props = {
  itemId?: string
  productName: string
  disabled?: boolean
  compact?: boolean
  className?: string
  onImageUrl?: (url: string) => void | Promise<void>
  onScanApplied: (
    patch: Partial<InventoryItemRow>,
    summary: string,
  ) => void
  onError?: (message: string) => void
}

const MAX_IMAGE_DIM = 1280

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer la imagen."))
        return
      }
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () =>
      reject(reader.error ?? new Error("No se pudo leer la imagen."))
    reader.readAsDataURL(file)
  })
}

/** Downscale large photos so upload + base64 + vision stay reliable on mobile. */
export async function prepareImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    if (longest <= MAX_IMAGE_DIM) return file

    const scale = MAX_IMAGE_DIM / longest
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    })
    if (!blob) return file

    const base = file.name.replace(/\.[^.]+$/, "") || "capture"
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" })
  } catch {
    return file
  } finally {
    bitmap?.close()
  }
}

function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  name: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo guardar la foto."))
          return
        }
        resolve(new File([blob], name, { type: "image/jpeg" }))
      },
      "image/jpeg",
      0.85,
    )
  })
}

export function InventoryCameraDialog({
  open,
  onOpenChange,
  onCapture,
  onError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
  onError?: (message: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [starting, setStarting] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
  }, [])

  useEffect(() => {
    if (!open) {
      stopStream()
      return
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      onError?.("La cámara no está disponible en este navegador.")
      onOpenChange(false)
      return
    }

    let cancelled = false
    setStarting(true)

    void navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          void video
            .play()
            .then(() => {
              if (!cancelled) setReady(true)
            })
            .catch(() => {
              onError?.(
                "No se pudo iniciar la vista de cámara. Usa Subir foto.",
              )
              onOpenChange(false)
            })
        }
      })
      .catch(() => {
        onError?.(
          "No se pudo usar la cámara. Permite el acceso o usa Subir foto.",
        )
        onOpenChange(false)
      })
      .finally(() => {
        if (!cancelled) setStarting(false)
      })

    return () => {
      cancelled = true
      stopStream()
    }
  }, [open, onError, onOpenChange, stopStream])

  async function takePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    try {
      const file = await canvasToJpegFile(
        canvas,
        `capture-${Date.now()}.jpg`,
      )
      onCapture(file)
      onOpenChange(false)
    } catch {
      onError?.("No se pudo guardar la foto.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle>Tomar foto</DialogTitle>
          <DialogDescription>
            Apunta al producto y pulsa Capturar. La IA llenará los campos.
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          {(starting || !ready) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="size-8 animate-spin text-white" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!ready || starting}
            onClick={() => void takePhoto()}
          >
            <Camera className="size-4 mr-1" />
            Capturar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function InventoryAiScanButton({
  itemId,
  productName,
  disabled,
  compact,
  className,
  onImageUrl,
  onScanApplied,
  onError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) {
      onError?.("Elige una imagen.")
      return
    }

    setBusy(true)
    try {
      const prepared = await prepareImageFile(file)
      if (prepared.size > 8 * 1024 * 1024) {
        onError?.("Máximo 8 MB. Acércate más o usa otra foto.")
        return
      }

      if (onImageUrl) {
        const { createBrowserSupabase } = await import("@/lib/supabase/client")
        const { uploadToFilesBucket } = await import("@/lib/supabase-storage")
        const client = createBrowserSupabase()
        const folder = itemId
          ? `inventory/${itemId}`
          : `inventory/scan-${Date.now()}`
        const url = await uploadToFilesBucket(client, prepared, folder)
        await onImageUrl(url)
      }

      const imageBase64 = await fileToBase64(prepared)
      const res = await fetch("/api/inventory-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: prepared.type || "image/jpeg",
          productName: productName?.trim() || "producto",
        }),
      })
      const data = (await res.json()) as {
        error?: string
        scan?: InventoryScanResult
      }
      if (!res.ok) {
        onError?.(data.error ?? "No se pudo analizar la imagen.")
        return
      }
      if (!data.scan) {
        onError?.("Respuesta vacía de la IA.")
        return
      }
      const patch = patchesFromInventoryScan(data.scan)
      const summary = inventoryScanSummary(data.scan, patch)
      onScanApplied(patch, summary)
    } catch (e) {
      console.error(e)
      onError?.(
        e instanceof Error ? e.message : "Error al analizar la imagen.",
      )
    } finally {
      setBusy(false)
    }
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) void processFile(file)
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      tabIndex={-1}
      onChange={onFileInput}
    />
  )

  const openGallery = () => fileRef.current?.click()
  const openCamera = () => {
    if (disabled || busy) return
    setCameraOpen(true)
  }

  if (compact) {
    return (
      <div className={cn("inline-flex", className)}>
        {fileInput}
        <InventoryCameraDialog
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(file) => void processFile(file)}
          onError={onError}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              disabled={disabled || busy}
              title="IA: cámara o subir foto"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Brain className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={openCamera}>
              <Camera className="size-4 mr-2" />
              Cámara
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openGallery}>
              <ImagePlus className="size-4 mr-2" />
              Subir foto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {fileInput}
      <InventoryCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => void processFile(file)}
        onError={onError}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        className="gap-2"
        title="Elegir imagen de la galería"
        onClick={openGallery}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Brain className="size-4" />
        )}
        {busy ? "Analizando…" : "Subir foto"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || busy}
        className="gap-1 text-xs h-8"
        title="Abrir cámara en vivo"
        onClick={openCamera}
      >
        <Camera className="size-3.5" />
        Cámara
      </Button>
    </div>
  )
}
