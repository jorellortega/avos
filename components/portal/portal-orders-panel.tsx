"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { Order } from "@/components/orders-provider"
import { Plus, Receipt } from "lucide-react"

type PortalOrdersPanelProps = {
  orders: Order[]
  selectedOrderId: string | null
  onSelectOrder: (orderId: string | null) => void
  onStartNewOrder: () => void
  nextOrderNumber: number
}

const statusLabel: Record<string, string> = {
  pendiente: "Pendiente",
  preparando: "Preparando",
  listo: "Listo",
  entregado: "Entregado",
  pagado: "Pagado",
}

export function PortalOrdersPanel({
  orders,
  selectedOrderId,
  onSelectOrder,
  onStartNewOrder,
  nextOrderNumber,
}: PortalOrdersPanelProps) {
  const active = orders
    .filter((o) => o.status === "pendiente" || o.status === "preparando")
    .sort((a, b) => b.numero - a.numero)

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      <div className="p-3 border-b space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2
            className="font-semibold text-sm flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Receipt className="h-4 w-4 text-primary" />
            Órdenes
          </h2>
          <Badge variant="secondary" className="text-xs">
            {active.length} activas
          </Badge>
        </div>
        <Button
          type="button"
          variant={selectedOrderId === null ? "default" : "outline"}
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => onStartNewOrder()}
        >
          <Plus className="h-4 w-4" />
          Nueva · #{nextOrderNumber}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {active.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">
              Sin órdenes activas
            </p>
          ) : (
            active.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelectOrder(order.id)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                  selectedOrderId === order.id
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border/80 bg-card hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-lg">#{order.numero}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {statusLabel[order.status] ?? order.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {order.items.length} artículo(s) · ${order.total.toFixed(2)}
                </p>
                {order.nombreCliente && (
                  <p className="text-xs truncate mt-0.5">{order.nombreCliente}</p>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
