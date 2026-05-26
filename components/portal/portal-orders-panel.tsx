"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Order, OrderStatus } from "@/components/orders-provider"
import { portalUpdateOrderStatus } from "@/lib/avos-orders-sync"
import { ChevronDown, Loader2, Plus, Receipt } from "lucide-react"

type PortalOrdersPanelProps = {
  orders: Order[]
  selectedOrderId: string | null
  onSelectOrder: (orderId: string | null) => void
  onStartNewOrder: () => void
  onOrderStatusChange: (orderId: string, status: OrderStatus) => void
  nextOrderNumber: number
}

const STATUS_OPTIONS: OrderStatus[] = [
  "pendiente",
  "preparando",
  "listo",
  "entregado",
  "pagado",
]

const statusLabel: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  preparando: "Preparando",
  listo: "Listo",
  entregado: "Entregado",
  pagado: "Pagado",
}

function OrderStatusPicker({
  order,
  onStatusChange,
}: {
  order: Order
  onStatusChange: (orderId: string, status: OrderStatus) => void
}) {
  const [saving, setSaving] = useState(false)

  const handlePick = async (status: OrderStatus) => {
    if (status === order.status || saving) return
    setSaving(true)
    const result = await portalUpdateOrderStatus(order.id, status)
    setSaving(false)
    if (result.ok) {
      onStatusChange(order.id, result.status ?? status)
    } else {
      alert(result.error ?? "No se pudo cambiar el estado.")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={saving}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize",
            "bg-background hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            saving && "opacity-60 pointer-events-none",
          )}
          title="Cambiar estado"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              {statusLabel[order.status]}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {STATUS_OPTIONS.map((status) => (
          <DropdownMenuItem
            key={status}
            className={cn(
              "text-xs capitalize",
              order.status === status && "font-semibold bg-accent",
            )}
            onSelect={() => void handlePick(status)}
          >
            {statusLabel[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PortalOrdersPanel({
  orders,
  selectedOrderId,
  onSelectOrder,
  onStartNewOrder,
  onOrderStatusChange,
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
                  <OrderStatusPicker
                    order={order}
                    onStatusChange={onOrderStatusChange}
                  />
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
