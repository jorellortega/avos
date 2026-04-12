"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/cart-provider"
import { Check } from "lucide-react"

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const { clearCart } = useCart()
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    if (sessionId && !cleared) {
      clearCart()
      setCleared(true)
    }
  }, [sessionId, cleared, clearCart])

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

  return (
    <div className="text-center px-4 max-w-md mx-auto py-16">
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
        Tu pago se registró correctamente. Recibirás la confirmación en tu correo.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/menu">
          <Button size="lg">Volver al menú</Button>
        </Link>
        <Link href="/">
          <Button size="lg" variant="outline">
            Inicio
          </Button>
        </Link>
      </div>
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
