"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, QrCode } from "lucide-react"

export default function OrderLookupPage() {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (orderNumber.trim()) {
      router.push(`/orden/${orderNumber}`)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-4">
        <div className="container mx-auto flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png"
            alt="Avos"
            width={80}
            height={32}
            className="h-8 w-auto"
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl" style={{ fontFamily: 'var(--font-heading)' }}>
              Consulta tu Orden
            </CardTitle>
            <p className="text-muted-foreground">
              Ingresa tu número de orden para ver el estado de tu pedido
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Número de orden"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="text-center text-2xl h-14 font-bold"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full gap-2" 
                size="lg"
                disabled={!orderNumber.trim()}
              >
                <Search className="h-4 w-4" />
                Buscar Orden
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Tu número de orden aparece en tu ticket o en la pantalla después de ordenar
              </p>
              <Link href="/menu">
                <Button variant="link" className="text-primary">
                  Hacer un nuevo pedido
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
