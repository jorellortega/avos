"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

type BebidaThumbProps = {
  src?: string | null
  alt: string
  className?: string
}

/** Small drink thumbnail — renders nothing when no URL. */
export function BebidaThumb({ src, alt, className }: BebidaThumbProps) {
  const url = src?.trim()
  if (!url) return null

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-muted",
        className ?? "h-14 w-14",
      )}
    >
      <Image
        src={url}
        alt={alt}
        fill
        className="object-cover"
        sizes="56px"
      />
    </div>
  )
}
