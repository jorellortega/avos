"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCart } from "@/components/cart-provider"
import { ArrowLeft, Clock, MapPin, CreditCard } from "lucide-react"

export default function CheckoutPage() {
  const router = useRouter()
  const { items, total } = useCart()
  const [isProcessing, setIsProcessing] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")
  const [isRedirecting, setIsRedirecting] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    email: "",
    horaRecogida: "",
    notasEspeciales: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.nombre.trim()) {
      newErrors.nombre = "El nombre es requerido"
    }
    if (!formData.telefono.trim()) {
      newErrors.telefono = "El teléfono es requerido"
    } else if (!/^\d{10}$/.test(formData.telefono.replace(/\D/g, ""))) {
      newErrors.telefono = "Ingresa un número de 10 dígitos"
    }
    if (!formData.email.trim()) {
      newErrors.email = "El correo es requerido"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Ingresa un correo válido"
    }
    if (!formData.horaRecogida) {
      newErrors.horaRecogida = "Selecciona una hora de recogida"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setCheckoutError("")
    setIsProcessing(true)

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
          })),
          customerEmail: formData.email.trim(),
          nombre: formData.nombre.trim(),
          telefono: formData.telefono.trim(),
          horaRecogida: formData.horaRecogida,
          notasEspeciales: formData.notasEspeciales,
        }),
      })

      const data = (await res.json()) as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        setCheckoutError(data.error ?? "No se pudo iniciar el pago.")
        setIsProcessing(false)
        return
      }

      window.location.href = data.url
    } catch {
      setCheckoutError("Error de red. Intenta de nuevo.")
      setIsProcessing(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  // Generate pickup time options (every 15 minutes for the next 3 hours)
  const generateTimeOptions = () => {
    const options = []
    const now = new Date()
    const startTime = new Date(now.getTime() + 20 * 60000) // Start 20 mins from now
    
    for (let i = 0; i < 12; i++) {
      const time = new Date(startTime.getTime() + i * 15 * 60000)
      const hours = time.getHours().toString().padStart(2, "0")
      const minutes = time.getMinutes().toString().padStart(2, "0")
      options.push(`${hours}:${minutes}`)
    }
    
    return options
  }

  // Redirect to cart if empty
  useEffect(() => {
    if (items.length === 0 && !isRedirecting) {
      setIsRedirecting(true)
      router.push("/carrito")
    }
  }, [items.length, router, isRedirecting])

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirigiendo al carrito...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4">
          <Link 
            href="/carrito" 
            className="inline-flex items-center text-muted-foreground hover:text-primary mb-6 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al carrito
          </Link>

          <h1 
            className="text-2xl md:text-3xl font-bold text-foreground mb-8"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Finalizar Pedido
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Checkout Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Contact Info */}
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
                      Información de Contacto
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="nombre">Nombre completo</Label>
                        <Input
                          id="nombre"
                          name="nombre"
                          value={formData.nombre}
                          onChange={handleInputChange}
                          placeholder="Juan García"
                          className={errors.nombre ? "border-destructive" : ""}
                        />
                        {errors.nombre && (
                          <p className="text-sm text-destructive mt-1">{errors.nombre}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="telefono">Teléfono</Label>
                        <Input
                          id="telefono"
                          name="telefono"
                          value={formData.telefono}
                          onChange={handleInputChange}
                          placeholder="55 1234 5678"
                          className={errors.telefono ? "border-destructive" : ""}
                        />
                        {errors.telefono && (
                          <p className="text-sm text-destructive mt-1">{errors.telefono}</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="juan@ejemplo.com"
                          className={errors.email ? "border-destructive" : ""}
                        />
                        {errors.email && (
                          <p className="text-sm text-destructive mt-1">{errors.email}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pickup Time */}
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
                      Hora de Recogida
                    </h2>
                    <div className="flex items-start gap-3 mb-4 p-3 bg-primary/5 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">Avos Mexican Grill</p>
                        <p className="text-sm text-muted-foreground">
                          Av. Revolución 123, Col. Centro, Ciudad de México
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="horaRecogida">Selecciona la hora</Label>
                      <select
                        id="horaRecogida"
                        name="horaRecogida"
                        value={formData.horaRecogida}
                        onChange={(e) => handleInputChange(e as unknown as React.ChangeEvent<HTMLInputElement>)}
                        className={`w-full mt-1 h-10 px-3 rounded-md border bg-background text-foreground ${
                          errors.horaRecogida ? "border-destructive" : "border-input"
                        }`}
                      >
                        <option value="">Seleccionar hora...</option>
                        {generateTimeOptions().map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                      {errors.horaRecogida && (
                        <p className="text-sm text-destructive mt-1">{errors.horaRecogida}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Special Notes */}
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
                      Notas Especiales (Opcional)
                    </h2>
                    <textarea
                      name="notasEspeciales"
                      value={formData.notasEspeciales}
                      onChange={handleInputChange}
                      placeholder="¿Alguna instrucción especial para tu pedido?"
                      className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-foreground resize-none"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
                      Pago
                    </h2>
                    <div className="flex items-center gap-3 p-4 border border-primary rounded-lg bg-primary/5">
                      <CreditCard className="h-6 w-6 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-medium">Tarjeta (MXN)</p>
                        <p className="text-sm text-muted-foreground">
                          Continuarás en una página segura para completar el pago con tarjeta.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {checkoutError && (
                  <p className="text-sm text-destructive" role="alert">
                    {checkoutError}
                  </p>
                )}

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? "Abriendo pago seguro..."
                    : `Pagar $${total.toFixed(2)}`}
                </Button>
              </form>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardContent className="p-6">
                  <h2 
                    className="text-xl font-bold text-foreground mb-4"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    Tu Pedido
                  </h2>

                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="text-foreground">{item.cantidad}x </span>
                          <span className="text-muted-foreground truncate">
                            {item.nombre}
                          </span>
                        </div>
                        <span className="font-medium ml-2">
                          ${(item.precio * item.cantidad).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-xl text-primary">
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
