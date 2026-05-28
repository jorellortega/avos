"use client"

import { useState } from "react"
import { Banknote, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PortalCashChange } from "@/components/portal/portal-cash-change"
import { staffConfirmAvosOrderPayment } from "@/lib/avos-orders-sync"

type PortalCollectPaymentProps = {
  orderId: string
  total: number
  disabled?: boolean
  onPaid: () => void
}

export function PortalCollectPayment({
  orderId,
  total,
  disabled,
  onPaid,
}: PortalCollectPaymentProps) {
  const [loading, setLoading] = useState<"efectivo" | "tarjeta" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function confirm(method: "efectivo" | "tarjeta") {
    if (loading || disabled) return
    setError(null)
    setLoading(method)
    const ok = await staffConfirmAvosOrderPayment(orderId, method)
    setLoading(null)
    if (!ok) {
      setError("No se pudo registrar el cobro en caja.")
      return
    }
    onPaid()
  }

  return (
    <div className="rounded-lg border border-green-600/30 bg-green-500/5 p-3 space-y-3">
      <p className="text-sm font-semibold text-green-800 dark:text-green-300">
        Cobrar en caja
      </p>
      <PortalCashChange total={total} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5 flex-1 min-w-[7rem]"
          disabled={Boolean(disabled || loading)}
          onClick={() => void confirm("efectivo")}
        >
          {loading === "efectivo" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Banknote className="h-4 w-4" />
          )}
          Efectivo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5 flex-1 min-w-[7rem]"
          disabled={Boolean(disabled || loading)}
          onClick={() => void confirm("tarjeta")}
        >
          {loading === "tarjeta" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          Terminal
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
