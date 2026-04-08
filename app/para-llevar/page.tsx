"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ShoppingBag, Clock } from "lucide-react"

export default function ParaLlevarPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")

  const handleContinue = () => {
    if (!nombre || !telefono) return
    // Store info in sessionStorage for the ordering flow
    sessionStorage.setItem("orderType", "takeout")
    sessionStorage.setItem("customerName", nombre)
    sessionStorage.setItem("customerPhone", telefono)
    router.push("/ordenar")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-10 w-10 text-primary" />
            </div>
            <h1 
              className="text-3xl font-bold text-foreground mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Para Llevar
            </h1>
            <p className="text-muted-foreground">
              Ordena y recoge tu pedido cuando esté listo
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tu Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium mb-2">
                  Nombre <span className="text-destructive">*</span>
                </label>
                <Input
                  id="nombre"
                  type="text"
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="telefono" className="block text-sm font-medium mb-2">
                  Teléfono <span className="text-destructive">*</span>
                </label>
                <Input
                  id="telefono"
                  type="tel"
                  placeholder="10 dígitos"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Te notificaremos cuando tu orden esté lista
                </p>
              </div>

              <Button 
                onClick={handleContinue}
                disabled={!nombre || !telefono}
                className="w-full"
                size="lg"
              >
                Continuar al Menú
              </Button>
            </CardContent>
          </Card>

          <div className="mt-6 bg-secondary/50 rounded-lg p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Tiempo estimado</p>
              <p className="text-sm text-muted-foreground">
                Tu orden estará lista en aproximadamente 15-20 minutos
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
