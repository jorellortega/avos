"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useCart } from "@/components/cart-provider"
import { Check } from "lucide-react"
import type { OrderStatusPayload } from "@/lib/checkout-order-status"

function statusLabel(data: OrderStatusPayload): { title: string; detail: string; variant: "default" | "secondary" | "outline" } {
  const st = data.status
  if (data.flow !== "order_pay" || !data.numero) {
    return { title: "Pedido", detail: "", variant: "secondary" }
  }
  if (st === "preparando") {
    return {
      title: "En preparación",
      detail: "La cocina está preparando tu pedido.",
      variant: "default",
    }
  }
  if (st === "listo") {
    return {
      title: "Listo para recoger",
      detail: "Puedes pasar a recoger cuando te indiquen en caja.",
      variant: "default",
    }
  }
  if (st === "entregado") {
    return {
      title: "Entregado",
      detail: "Gracias por tu compra.",
      variant: "secondary",
    }
  }
  if (st === "pagado" || data.paid_at) {
    return {
      title: "Pago recibido",
      detail: "Tu pedido está en cola; el estado se actualizará cuando la cocina avance.",
      variant: "default",
    }
  }
  if (st === "pendiente") {
    return {
      title: "Confirmando pago",
      detail: "Actualizando tu pedido en el sistema…",
      variant: "outline",
    }
  }
  return {
    title: "Pedido registrado",
    detail: "Seguimiento activo.",
    variant: "secondary",
  }
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const { clearCart } = useCart()
  const [cleared, setCleared] = useState(false)
  const [orderStatus, setOrderStatus] = useState<OrderStatusPayload | null>(null)

  useEffect(() => {
    if (sessionId && !cleared) {
      clearCart()
      setCleared(true)
    }
  }, [sessionId, cleared, clearCart])

  useEffect(() => {
    if (!sessionId) return

    const tick = async () => {
      try {
        await fetch("/api/checkout/sync-order-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const res = await fetch(
          `/api/checkout/order-status?session_id=${encodeURIComponent(sessionId)}`,
        )
        if (res.ok) {
          const data = (await res.json()) as OrderStatusPayload
          setOrderStatus(data)
        }
      } catch {
        /* ignore */
      }
    }

    void tick()
    const interval = setInterval(() => void tick(), 5000)
    return () => clearInterval(interval)
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="text-center px-4 py-16 max-w-md mx-auto">
        <p className="text-muted-foreground mb-6">No se encontró la sesión de pago.</p>
        <Link href="/checkout">
          <Button>Volver al checkout</Button>
        </Link>
      </div>
    )
  }

  const numero = orderStatus?.numero
  const isOrderPay = orderStatus?.flow === "order_pay" && numero != null
  const sl = orderStatus ? statusLabel(orderStatus) : null

  return (
    <div className="px-4 max-w-lg mx-auto py-16">
      <div className="text-center">
        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold text-foreground mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          ¡Pago recibido!
        </h1>
        <p className="text-muted-foreground mb-8">
          Tu pago se registró correctamente.
          {isOrderPay ? (
            <>
              {" "}
              Pedido #{numero}: el estado se actualiza abajo en vivo.
            </>
          ) : (
            <> Recibirás la confirmación en tu correo cuando aplique.</>
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap mb-10">
          {isOrderPay && (
            <Link href={`/orden/${numero}`}>
              <Button size="lg">Ver pedido #{numero}</Button>
            </Link>
          )}
          <Link href="/menu">
            <Button size="lg" variant={isOrderPay ? "outline" : "default"}>
              Volver al menú
            </Button>
          </Link>
          <Link href="/">
            <Button size="lg" variant="outline">
              Inicio
            </Button>
          </Link>
        </div>
      </div>

      {sessionId && isOrderPay && (
        <Card className="text-left border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle
                className="text-lg font-semibold"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Estado del pedido #{numero}
              </CardTitle>
              {sl ? <Badge variant={sl.variant}>{sl.title}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {orderStatus?.total != null && (
              <p>
                <span className="text-foreground font-medium">Total:</span> $
                {orderStatus.total.toFixed(2)} MXN
              </p>
            )}
            {sl?.detail ? <p>{sl.detail}</p> : null}
            <p className="text-xs pt-1 border-t border-border/60">
              Se actualiza solo cada pocos segundos. También puedes ver el detalle en{" "}
              <Link
                href={`/orden/${numero}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                tu página del pedido
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense
          fallback={
            <p className="text-center text-muted-foreground py-16">Cargando...</p>
          }
        >
          <SuccessContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
