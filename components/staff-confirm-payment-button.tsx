"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { staffConfirmAvosOrderPayment } from "@/lib/avos-orders-sync"

type Props = {
  orderId: string
  /** How the customer said they will pay (from app). Drives label + one-tap for card. */
  intentMethod?: string | null
  /** mesa | pickup — pickup is card-only */
  orderType?: string | null
}

export function StaffConfirmPaymentButton({
  orderId,
  intentMethod,
  orderType,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(method: "efectivo" | "tarjeta") {
    setLoading(true)
    setError(null)
    const ok = await staffConfirmAvosOrderPayment(orderId, method)
    setLoading(false)
    if (!ok) {
      setError("No se pudo confirmar")
      return
    }
    window.location.reload()
  }

  const intent = intentMethod === "efectivo" || intentMethod === "tarjeta" ? intentMethod : null
  const isPickup = orderType === "pickup"

  if (isPickup) {
    return (
      <div className="flex flex-col items-end gap-1">
        {error && (
          <span className="text-xs text-destructive max-w-[180px] text-right">
            {error}
          </span>
        )}
        <Button
          size="sm"
          disabled={loading}
          className="whitespace-nowrap"
          onClick={() => void confirm("tarjeta")}
        >
          {loading ? "…" : "Pagar con tarjeta"}
        </Button>
      </div>
    )
  }

  if (intent === "tarjeta") {
    return (
      <div className="flex flex-col items-end gap-1">
        {error && (
          <span className="text-xs text-destructive max-w-[180px] text-right">
            {error}
          </span>
        )}
        <Button
          size="sm"
          disabled={loading}
          className="whitespace-nowrap"
          onClick={() => void confirm("tarjeta")}
        >
          {loading ? "…" : "Pagar con tarjeta"}
        </Button>
      </div>
    )
  }

  if (intent === "efectivo") {
    return (
      <div className="flex flex-col items-end gap-1">
        {error && (
          <span className="text-xs text-destructive max-w-[180px] text-right">
            {error}
          </span>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={loading}
          className="whitespace-nowrap"
          onClick={() => void confirm("efectivo")}
        >
          {loading ? "…" : "Confirmar efectivo"}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && (
        <span className="text-xs text-destructive max-w-[180px] text-right">
          {error}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={loading}>
            {loading ? "…" : "Confirmar pago"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void confirm("efectivo")}>
            Efectivo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void confirm("tarjeta")}>
            Tarjeta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
