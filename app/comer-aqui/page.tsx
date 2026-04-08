"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Utensils, QrCode } from "lucide-react"

export default function ComerAquiPage() {
  const router = useRouter()
  const [mesa, setMesa] = useState("")
  const [nombre, setNombre] = useState("")

  const handleContinue = () => {
    if (!mesa) return
    // Store table info in sessionStorage for the ordering flow
    sessionStorage.setItem("orderType", "dine-in")
    sessionStorage.setItem("tableNumber", mesa)
    sessionStorage.setItem("customerName", nombre)
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
              <Utensils className="h-10 w-10 text-primary" />
            </div>
            <h1 
              className="text-3xl font-bold text-foreground mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Comer Aquí
            </h1>
            <p className="text-muted-foreground">
              Ingresa tu número de mesa para comenzar tu orden
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información de Mesa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="mesa" className="block text-sm font-medium mb-2">
                  Número de Mesa <span className="text-destructive">*</span>
                </label>
                <Input
                  id="mesa"
                  type="number"
                  placeholder="Ej: 5"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                  className="text-lg text-center"
                  min="1"
                />
              </div>

              <div>
                <label htmlFor="nombre" className="block text-sm font-medium mb-2">
                  Tu Nombre <span className="text-muted-foreground">(opcional)</span>
                </label>
                <Input
                  id="nombre"
                  type="text"
                  placeholder="Ej: Carlos"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleContinue}
                disabled={!mesa}
                className="w-full"
                size="lg"
              >
                Continuar al Menú
              </Button>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <div className="flex items-center gap-4 justify-center text-muted-foreground text-sm mb-4">
              <div className="h-px bg-border flex-1" />
              <span>o</span>
              <div className="h-px bg-border flex-1" />
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <QrCode className="h-5 w-5" />
              <span>Escanea el código QR en tu mesa</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
