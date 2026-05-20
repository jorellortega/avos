"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type MediaUrlThumbProps = {
  src?: string | null
  alt: string
  className?: string
  size?: "sm" | "md"
}

function isPreviewableUrl(url: string) {
  const u = url.trim()
  if (!u) return false
  if (u === "/placeholder.svg" || u === "/placeholder.jpg") return false
  return true
}

/** Thumbnail preview for /edit — shows image when URL is set and loads. */
export function MediaUrlThumb({
  src,
  alt,
  className,
  size = "md",
}: MediaUrlThumbProps) {
  const url = src?.trim() ?? ""
  const previewable = isPreviewableUrl(url)
  const [failed, setFailed] = useState(false)
  const dim = size === "sm" ? "h-10 w-10" : "h-14 w-14"

  useEffect(() => {
    setFailed(false)
  }, [url])

  const showImage = previewable && !failed

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border border-border bg-muted",
        dim,
        className,
      )}
    >
      {showImage ? (
        <Image
          key={url}
          src={url}
          alt={alt}
          fill
          className="object-cover"
          sizes={size === "sm" ? "40px" : "56px"}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted/50">
          <ImageIcon
            className={cn(
              "text-muted-foreground",
              size === "sm" ? "h-4 w-4" : "h-5 w-5",
            )}
          />
        </div>
      )}
    </div>
  )
}
