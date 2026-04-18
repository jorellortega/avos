"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useOrders, OrderStatus } from "@/components/orders-provider"
import { ChefHat, Users, Clock, Check, Play, ArrowLeft, RefreshCw } from "lucide-react"

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300" },
  preparando: { label: "Preparando", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
  listo: { label: "Listo", color: "text-green-700", bg: "bg-green-100 border-green-300" },
  entregado: { label: "Entregado", color: "text-gray-700", bg: "bg-gray-100 border-gray-300" },
  pagado: { label: "Pagado", color: "text-primary", bg: "bg-primary/10 border-primary/30" },
}

export default function CocinaPage() {
  const { orders, updateOrderStatus } = useOrders()
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Auto-refresh orders
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to show updated times
      setCurrentTime(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Incluye pagado (pago en línea) hasta que cocina avance; excluye solo entregado.
  const activeOrders = orders
    .filter(o => o.status !== "entregado")
    .sort((a, b) => {
      // Sort by status priority, then by creation time
      const statusOrder = { pendiente: 0, pagado: 1, preparando: 2, listo: 3 }
      const statusDiff = (statusOrder[a.status as keyof typeof statusOrder] ?? 9) - (statusOrder[b.status as keyof typeof statusOrder] ?? 9)
      if (statusDiff !== 0) return statusDiff
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

  const pendingCount = orders.filter(o => o.status === "pendiente").length
  const preparingCount = orders.filter(o => o.status === "preparando").length
  const readyCount = orders.filter(o => o.status === "listo").length

  const getTimeSince = (date: Date) => {
    const mins = Math.floor((currentTime.getTime() - new Date(date).getTime()) / 60000)
    if (mins < 1) return "Ahora"
    if (mins === 1) return "1 min"
    return `${mins} min`
  }

  const handleStatusChange = async (orderId: string, currentStatus: OrderStatus) => {
    const nextStatus: Record<OrderStatus, OrderStatus> = {
      pendiente: "preparando",
      preparando: "listo",
      listo: "entregado",
      entregado: "entregado",
      pagado: "preparando",
    }
    const next = nextStatus[currentStatus]
    if (!next || next === currentStatus) return

    try {
      const res = await fetch("/api/kitchen/advance-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; status?: string }
      if (!res.ok || !data.ok) {
        console.error("[cocina]", data.error)
        alert(data.error ?? "No se pudo actualizar en el servidor. Revisa la consola.")
        return
      }
      updateOrderStatus(orderId, (data.status as OrderStatus) ?? next)
    } catch (e) {
      console.error("[cocina]", e)
      alert("Error de red al guardar el estado.")
    }
  }

  const getNextActionLabel = (status: OrderStatus) => {
    switch (status) {
      case "pendiente":
      case "pagado":
        return "Empezar"
      case "preparando":
        return "Listo"
      case "listo":
        return "Entregado"
      default:
        return ""
    }
  }

  const getNextActionIcon = (status: OrderStatus) => {
    switch (status) {
      case "pendiente":
      case "pagado":
        return <Play className="h-4 w-4" />
      case "preparando":
        return <Check className="h-4 w-4" />
      case "listo":
        return <Check className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/staff">
              <Button variant="ghost" size="icon" className="text-background hover:bg-background/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <ChefHat className="h-6 w-6" />
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                Pantalla de Cocina
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
              {pendingCount} pendientes
            </Badge>
            <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              {preparingCount} preparando
            </Badge>
            <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/30">
              {readyCount} listos
            </Badge>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-background hover:bg-background/10"
              onClick={() => setCurrentTime(new Date())}
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <ChefHat className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              No hay órdenes activas
            </h2>
            <p className="text-muted-foreground">
              Las nuevas órdenes aparecerán aquí automáticamente
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeOrders.map(order => {
              const config = statusConfig[order.status]
              return (
                <Card 
                  key={order.id} 
                  className={`border-2 ${config.bg} transition-all duration-300`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle 
                        className="text-2xl"
                        style={{ fontFamily: 'var(--font-heading)' }}
                      >
                        #{order.numero}
                      </CardTitle>
                      <Badge className={`${config.color} bg-transparent border-current`}>
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getTimeSince(order.createdAt)}
                      </span>
                      {order.nombreCliente && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {order.nombreCliente}
                        </span>
                      )}
                      {order.mesa && (
                        <span className="font-medium">Mesa {order.mesa}</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Items */}
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between bg-background/50 rounded px-3 py-2"
                        >
                          <span className="font-medium">
                            {item.cantidad}x {item.nombre}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Action Button */}
                    {order.status !== "entregado" && (
                      <Button
                        className="w-full gap-2"
                        size="lg"
                        variant={order.status === "listo" ? "secondary" : "default"}
                        onClick={() => void handleStatusChange(order.id, order.status)}
                      >
                        {getNextActionIcon(order.status)}
                        {getNextActionLabel(order.status)}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
