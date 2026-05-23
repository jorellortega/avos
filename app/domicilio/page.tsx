"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DeliveryZonePicker } from "@/components/delivery-zone-picker"
import { DeliveryPhotoUpload } from "@/components/delivery-photo-upload"
import { useDeliveryZones } from "@/hooks/use-delivery-zones"
import type { DeliveryZone } from "@/lib/delivery-zones"
import { ArrowLeft, Truck } from "lucide-react"

export default function DomicilioPage() {
  const router = useRouter()
  const { zones, loading } = useDeliveryZones()
  const [selected, setSelected] = useState<DeliveryZone | null>(null)
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [direccion, setDireccion] = useState("")
  const [photoStreet, setPhotoStreet] = useState<string | null>(null)
  const [photoHouse, setPhotoHouse] = useState<string | null>(null)

  const canContinue =
    Boolean(selected) &&
    nombre.trim() &&
    telefono.trim() &&
    direccion.trim() &&
    photoStreet &&
    photoHouse

  const handleContinue = () => {
    if (!canContinue || !selected) return
    sessionStorage.setItem("orderType", "domicilio")
    sessionStorage.setItem("customerName", nombre.trim())
    sessionStorage.setItem("customerPhone", telefono.trim())
    sessionStorage.setItem("deliveryZoneId", selected.id)
    sessionStorage.setItem("deliveryZoneLabel", selected.label)
    sessionStorage.setItem("deliveryFee", String(selected.fee))
    sessionStorage.setItem("deliveryAddress", direccion.trim())
    sessionStorage.setItem("deliveryPhotoStreetUrl", photoStreet!)
    sessionStorage.setItem("deliveryPhotoHouseUrl", photoHouse!)
    sessionStorage.removeItem("tableNumber")
    router.push("/ordenar")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-lg">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="h-10 w-10 text-primary" />
          </div>
          <h1
            className="text-3xl font-bold text-foreground mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Domicilio
          </h1>
          <p className="text-muted-foreground">
            Entregamos en Pastor Ortiz. Elige tu zona, dirección y fotos para
            encontrarte.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Cargando zonas…</p>
        ) : (
          <div className="space-y-6">
            <DeliveryZonePicker
              data={zones}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Datos de entrega</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="nombre" className="block text-sm font-medium mb-2">
                    Nombre <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label htmlFor="telefono" className="block text-sm font-medium mb-2">
                    Teléfono <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="telefono"
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="10 dígitos"
                  />
                </div>
                <div>
                  <label htmlFor="direccion" className="block text-sm font-medium mb-2">
                    Dirección y referencias <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    id="direccion"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle, número, color de casa, puntos de referencia…"
                    rows={3}
                    maxLength={300}
                  />
                </div>

                <DeliveryPhotoUpload
                  id="photo-street"
                  label="Foto de la calle"
                  hint="Muestra la calle o esquina donde entregamos."
                  value={photoStreet}
                  onChange={setPhotoStreet}
                />

                <DeliveryPhotoUpload
                  id="photo-house"
                  label="Foto de la casa"
                  hint="Fachada, puerta o portón para identificar el domicilio."
                  value={photoHouse}
                  onChange={setPhotoHouse}
                />

                {selected ? (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Envío ({selected.label}): </span>
                    <span className="font-semibold text-primary">
                      ${selected.fee.toFixed(2)} MXN
                    </span>
                    <span className="block text-xs text-muted-foreground mt-1">
                      Se suma al total de tu pedido al pagar.
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Selecciona tu zona en el mapa arriba.
                  </p>
                )}

                <Button
                  onClick={handleContinue}
                  disabled={!canContinue}
                  className="w-full"
                  size="lg"
                >
                  Continuar al menú
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
