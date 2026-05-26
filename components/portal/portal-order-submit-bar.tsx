"use client"

import { QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type PortalOrderSubmitBarProps = {
  total: number
  submitLabel: string
  loadingLabel: string
  disabled: boolean
  loading: boolean
  onSubmit: () => void
  showReadyHint?: boolean
}

export function PortalOrderSubmitBar({
  total,
  submitLabel,
  loadingLabel,
  disabled,
  loading,
  onSubmit,
  showReadyHint,
}: PortalOrderSubmitBarProps) {
  return (
    <Card className="border-primary/20 shadow-sm">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={disabled || loading}
          onClick={onSubmit}
        >
          {loading ? loadingLabel : submitLabel}
        </Button>
        {showReadyHint && (
          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <QrCode className="h-3 w-3" aria-hidden />
            Listo para cobrar después de enviar
          </p>
        )}
      </CardContent>
    </Card>
  )
}
