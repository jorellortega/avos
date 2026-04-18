import Link from "next/link"
import { createServerSupabase } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClientSignOutButton } from "@/components/client-sign-out-button"
import { Package, Tag } from "lucide-react"

export default async function CuentaHomePage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle()

  const name = profile?.full_name?.trim() || user.email?.split("@")[0] || "Cliente"

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Hola, {name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Tu espacio para seguir pedidos y enterarte de promociones.
          </p>
        </div>
        <ClientSignOutButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <Package className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-lg">Mis pedidos</CardTitle>
            <CardDescription>
              Historial de pedidos hechos con tu cuenta en el restaurante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/cuenta/pedidos">Ver pedidos</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Tag className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-lg">Ofertas</CardTitle>
            <CardDescription>
              Cupones y promociones próximamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/cuenta/ofertas">Explorar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Tip: inicia sesión antes de ordenar para que tus pedidos aparezcan aquí
        automáticamente.
      </p>
    </div>
  )
}
