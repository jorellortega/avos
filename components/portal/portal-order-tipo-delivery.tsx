"use client"

import { useEffect, useState } from "react"
import type { OrderType } from "@/components/orders-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PortalDomicilioDelivery } from "@/components/portal/portal-domicilio-delivery"
import { PortalOrderTipoPicker } from "@/components/portal/portal-order-tipo-picker"
import {
  parsePortalDeliveryFeeInput,
  type PortalDeliveryInfo,
} from "@/lib/portal-delivery"
import { cn } from "@/lib/utils"

type PortalOrderTipoDeliveryProps = {
  orderTipo: OrderType
  onOrderTipoChange: (tipo: OrderType) => void
  delivery: PortalDeliveryInfo
  needsDelivery: boolean
  onDeliverySave: (delivery: PortalDeliveryInfo) => void
  onDeliveryFeeChange: (fee: number) => void
  disabled?: boolean
  className?: string
}

export function PortalOrderTipoDelivery({
  orderTipo,
  onOrderTipoChange,
  delivery,
  needsDelivery,
  onDeliverySave,
  onDeliveryFeeChange,
  disabled,
  className,
}: PortalOrderTipoDeliveryProps) {
  const fee = delivery.deliveryFee ?? 0
  const [feeText, setFeeText] = useState(fee > 0 ? fee.toFixed(2) : "")

  useEffect(() => {
    const f = delivery.deliveryFee ?? 0
    setFeeText((prev) => {
      const parsed = parsePortalDeliveryFeeInput(prev)
      if (parsed === f) return prev
      return f > 0 ? f.toFixed(2) : ""
    })
  }, [delivery.deliveryFee])

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          Servicio
        </span>
        <PortalOrderTipoPicker
          variant="inline"
          value={orderTipo}
          onChange={onOrderTipoChange}
          disabled={disabled}
        />
      </div>

      {orderTipo === "domicilio" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-[7rem]">
              <Label htmlFor="portal-delivery-fee" className="text-xs font-medium">
                Envío domicilio
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="portal-delivery-fee"
                  type="text"
                  inputMode="decimal"
                  placeholder="15.00"
                  disabled={disabled}
                  className="pl-7 h-9 tabular-nums"
                  value={feeText}
                  onChange={(e) => {
                    const next = e.target.value
                    setFeeText(next)
                    onDeliveryFeeChange(parsePortalDeliveryFeeInput(next))
                  }}
                  onBlur={() => {
                    const parsed = parsePortalDeliveryFeeInput(feeText)
                    setFeeText(parsed > 0 ? parsed.toFixed(2) : "")
                    onDeliveryFeeChange(parsed)
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Por defecto $15; cámbialo si el viaje es más lejos.
              </p>
            </div>
          </div>
          <PortalDomicilioDelivery
            delivery={delivery}
            needsDelivery={needsDelivery}
            onSave={onDeliverySave}
          />
        </div>
      ) : null}
    </div>
  )
}
