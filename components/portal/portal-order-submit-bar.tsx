"use client"

import { QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { OrderType } from "@/components/orders-provider"
import { PortalCashChange } from "@/components/portal/portal-cash-change"
import { PortalExtraCharge } from "@/components/portal/portal-extra-charge"
import { PortalOrderTipoDelivery } from "@/components/portal/portal-order-tipo-delivery"
import type { PortalDeliveryInfo } from "@/lib/portal-delivery"

type PortalOrderSubmitBarProps = {
  total: number
  itemsSubtotal: number
  deliveryFee?: number
  orderTipo?: OrderType
  onOrderTipoChange?: (tipo: OrderType) => void
  delivery?: PortalDeliveryInfo
  needsDelivery?: boolean
  onDeliverySave?: (delivery: PortalDeliveryInfo) => void
  onDeliveryFeeChange?: (fee: number) => void
  extraCharge: number
  onExtraChargeChange: (amount: number) => void
  submitLabel: string
  loadingLabel: string
  disabled: boolean
  loading: boolean
  onSubmit: () => void
  showReadyHint?: boolean
  /** Show efectivo / cambio calculator (default true). */
  showCashChange?: boolean
}

export function PortalOrderSubmitBar({
  total,
  itemsSubtotal,
  deliveryFee = 0,
  orderTipo = "mesa",
  onOrderTipoChange,
  delivery = {},
  needsDelivery = false,
  onDeliverySave,
  onDeliveryFeeChange,
  extraCharge,
  onExtraChargeChange,
  submitLabel,
  loadingLabel,
  disabled,
  loading,
  onSubmit,
  showReadyHint,
  showCashChange = true,
}: PortalOrderSubmitBarProps) {
  const showDelivery = deliveryFee > 0
  const showExtra = extraCharge > 0
  const showBreakdown = showDelivery || showExtra
  const showTipoDelivery =
    onOrderTipoChange && onDeliverySave && onDeliveryFeeChange

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardContent className="py-4 space-y-3">
        <PortalExtraCharge
          value={extraCharge}
          onChange={onExtraChargeChange}
          disabled={disabled || loading}
        />

        {showBreakdown ? (
          <div className="space-y-1 text-sm border-t pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Artículos</span>
              <span className="tabular-nums">${itemsSubtotal.toFixed(2)}</span>
            </div>
            {showDelivery ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Envío</span>
                <span className="tabular-nums">${deliveryFee.toFixed(2)}</span>
              </div>
            ) : null}
            {showExtra ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Cargo adicional</span>
                <span className="tabular-nums">${extraCharge.toFixed(2)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {showTipoDelivery ? (
          <PortalOrderTipoDelivery
            orderTipo={orderTipo}
            onOrderTipoChange={onOrderTipoChange}
            delivery={delivery}
            needsDelivery={needsDelivery}
            onDeliverySave={onDeliverySave}
            onDeliveryFeeChange={onDeliveryFeeChange}
            disabled={disabled || loading}
            className="border-t pt-3"
          />
        ) : null}

        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span className="tabular-nums">${total.toFixed(2)}</span>
        </div>

        {showCashChange ? <PortalCashChange total={total} /> : null}

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
