"use client"

import { memo, useMemo, useState } from "react"
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
import { isOrderCreatedToday } from "@/lib/portal-today-orders"
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

function isActiveStatus(status: OrderStatus) {
  return status === "pendiente" || status === "preparando"
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })
}

function OrderStatusPicker({
  orderId,
  status,
  onStatusChange,
}: {
  orderId: string
  status: OrderStatus
  onStatusChange: (orderId: string, status: OrderStatus) => void
}) {
  const [saving, setSaving] = useState(false)

  const handlePick = async (next: OrderStatus) => {
    if (next === status || saving) return
    const previous = status
    onStatusChange(orderId, next)
    setSaving(true)
    const result = await portalUpdateOrderStatus(orderId, next)
    setSaving(false)
    if (!result.ok) {
      onStatusChange(orderId, previous)
      alert(result.error ?? "No se pudo cambiar el estado.")
      return
    }
    if (result.status && result.status !== next) {
      onStatusChange(orderId, result.status)
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
              {statusLabel[status]}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option}
            className={cn(
              "text-xs capitalize",
              status === option && "font-semibold bg-accent",
            )}
            onSelect={(e) => {
              e.preventDefault()
              void handlePick(option)
            }}
          >
            {statusLabel[option]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const PortalOrderRow = memo(function PortalOrderRow({
  order,
  selected,
  onSelectOrder,
  onOrderStatusChange,
}: {
  order: Order
  selected: boolean
  onSelectOrder: (orderId: string) => void
  onOrderStatusChange: (orderId: string, status: OrderStatus) => void
}) {
  const active = isActiveStatus(order.status)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectOrder(order.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelectOrder(order.id)
        }
      }}
      className={cn(
        "w-full text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
          : "border-border/80 bg-card hover:bg-muted/50",
        active && !selected && "border-l-2 border-l-primary/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-lg">#{order.numero}</span>
        <OrderStatusPicker
          orderId={order.id}
          status={order.status}
          onStatusChange={onOrderStatusChange}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {formatTime(order.createdAt)} · {order.items.length} artículo(s) · $
        {order.total.toFixed(2)}
        {active ? (
          <span className="ml-1.5 text-primary font-medium">· Activa</span>
        ) : null}
      </p>
      {order.nombreCliente && (
        <p className="text-xs truncate mt-0.5">{order.nombreCliente}</p>
      )}
    </div>
  )
})

export function PortalOrdersPanel({
  orders,
  selectedOrderId,
  onSelectOrder,
  onStartNewOrder,
  onOrderStatusChange,
  nextOrderNumber,
}: PortalOrdersPanelProps) {
  const todayOrders = useMemo(
    () =>
      orders
        .filter((o) => isOrderCreatedToday(o.createdAt))
        .sort((a, b) => b.numero - a.numero),
    [orders],
  )

  const activeCount = useMemo(
    () => todayOrders.filter((o) => isActiveStatus(o.status)).length,
    [todayOrders],
  )

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      <div className="p-3 border-b space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2
            className="font-semibold text-sm flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Receipt className="h-4 w-4 text-primary" />
            Hoy
          </h2>
          <div className="flex items-center gap-1.5">
            {activeCount > 0 ? (
              <Badge variant="default" className="text-xs">
                {activeCount} activa{activeCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-xs">
              {todayOrders.length}
            </Badge>
          </div>
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
          {todayOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">
              Sin órdenes de hoy
            </p>
          ) : (
            todayOrders.map((order) => (
              <PortalOrderRow
                key={order.id}
                order={order}
                selected={selectedOrderId === order.id}
                onSelectOrder={onSelectOrder}
                onOrderStatusChange={onOrderStatusChange}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
