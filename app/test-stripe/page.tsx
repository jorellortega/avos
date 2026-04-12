"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CreditCard, FlaskConical } from "lucide-react"

const hasPublishableKey = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

function TestStripeContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get("status")
  const sessionId = searchParams.get("session_id")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const startTestCheckout = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/test-stripe", { method: "POST" })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? "No se pudo iniciar el pago de prueba.")
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError("Error de red.")
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 md:py-14 max-w-2xl">
      <Link
        href="/"
        className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 text-sm"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al inicio
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <FlaskConical className="h-8 w-8 text-primary" />
        <h1
          className="text-2xl md:text-3xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Prueba Stripe (sandbox)
        </h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Página para practicar pagos con claves de prueba. El cargo es de{" "}
        <strong>$10.00 MXN</strong> y no usa tu carrito real.
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        <Badge variant="secondary">Modo prueba</Badge>
        {hasPublishableKey ? (
          <Badge variant="outline">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ✓</Badge>
        ) : (
          <Badge variant="destructive">Falta publishable key</Badge>
        )}
      </div>

      {status === "success" && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <p className="font-medium text-foreground mb-1">Pago de prueba completado</p>
            <p className="text-sm text-muted-foreground">
              Stripe redirigió correctamente. Revisa el pago en el{" "}
              <a
                href="https://dashboard.stripe.com/test/payments"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                panel de Stripe (test)
              </a>
              .
            </p>
            {sessionId && (
              <p className="text-xs font-mono text-muted-foreground mt-2 break-all">
                session_id: {sessionId}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {status === "canceled" && (
        <Card className="mb-6 border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Cancelaste el flujo en Stripe. Puedes intentar de nuevo cuando quieras.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Tarjeta de prueba (éxito)</p>
              <p className="text-sm text-muted-foreground font-mono">
                4242 4242 4242 4242 · cualquier fecha futura · CVC cualquiera
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={startTestCheckout}
          >
            {loading ? "Abriendo Stripe…" : "Iniciar pago de prueba ($10 MXN)"}
          </Button>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Esta ruta solo acepta <code className="bg-muted px-1 rounded">sk_test_…</code>. Con
        claves live, el botón devolverá error a propósito.
      </p>
    </div>
  )
}

export default function TestStripePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense
          fallback={
            <p className="text-center text-muted-foreground py-16">Cargando…</p>
          }
        >
          <TestStripeContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
