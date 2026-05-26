"use client"

import { useEffect, useState } from "react"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DeliveryZonePicker } from "@/components/delivery-zone-picker"
import { useDeliveryZones } from "@/hooks/use-delivery-zones"
import type { PortalDeliveryInfo } from "@/lib/portal-delivery"
import type { DeliveryZone } from "@/lib/delivery-zones"
import { cn } from "@/lib/utils"

type PortalDomicilioDeliveryProps = {
  delivery: PortalDeliveryInfo
  needsDelivery: boolean
  onSave: (delivery: PortalDeliveryInfo) => void
}

export function PortalDomicilioDelivery({
  delivery,
  needsDelivery,
  onSave,
}: PortalDomicilioDeliveryProps) {
  const { zones, loading } = useDeliveryZones()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<DeliveryZone | null>(null)
  const [notes, setNotes] = useState(delivery.deliveryAddress ?? "")

  useEffect(() => {
    if (!open) return
    if (delivery.deliveryZoneId) {
      const z = zones.zones.find((x) => x.id === delivery.deliveryZoneId)
      setSelected(z ?? null)
    } else {
      setSelected(null)
    }
    setNotes(delivery.deliveryAddress ?? "")
  }, [open, delivery.deliveryZoneId, delivery.deliveryAddress, zones.zones])

  const handleSave = () => {
    if (!selected || !notes.trim()) return
    onSave({
      deliveryZoneId: selected.id,
      deliveryZoneLabel: selected.label,
      deliveryFee: selected.fee,
      deliveryAddress: notes.trim(),
    })
    setOpen(false)
  }

  const summary = delivery.deliveryZoneLabel
    ? `${delivery.deliveryZoneLabel}${delivery.deliveryFee != null ? ` · envío $${delivery.deliveryFee.toFixed(0)}` : ""}`
    : null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          "w-full text-left rounded-md border px-2.5 py-2 text-xs transition-colors",
          needsDelivery
            ? "border-destructive bg-destructive/10 text-destructive hover:bg-destructive/15"
            : "border-border/80 bg-muted/40 hover:bg-muted/60 text-foreground",
        )}
      >
        <span className="flex items-start gap-1.5 font-medium">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0">
            {needsDelivery ? (
              <>Falta ubicación de domicilio — toca para elegir zona y notas</>
            ) : (
              <>
                <span className="block">{summary}</span>
                <span className="block font-normal text-muted-foreground mt-0.5 line-clamp-2">
                  {delivery.deliveryAddress}
                </span>
              </>
            )}
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Entrega a domicilio</DialogTitle>
            <DialogDescription>
              Elige la colonia o sector y escribe dirección y referencias.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Cargando zonas…
            </p>
          ) : (
            <div className="space-y-4">
              <DeliveryZonePicker
                data={zones}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
              <div>
                <label
                  htmlFor="portal-delivery-notes"
                  className="text-sm font-medium block mb-1.5"
                >
                  Dirección y notas <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="portal-delivery-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Calle, número, color de casa, referencias…"
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!selected || !notes.trim()}
              onClick={handleSave}
            >
              Guardar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
