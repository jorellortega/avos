import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isManagerOrCeo } from "@/lib/profile-types"
import { OrderingSettingsPanel } from "@/components/ordering-settings-panel"

export default async function StaffOrderingPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/staff/ordering")
  }

  const { data: profileRow } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle()
  const profile = profileRow as StaffProfile | null

  if (!profile || !isManagerOrCeo(profile.role)) {
    redirect("/staff/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-10 md:py-14">
        <div className="container mx-auto px-4 max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                Pedidos en línea
              </h1>
              <p className="text-muted-foreground mt-1">
                Activa o pausa pedidos para clientes (menú / checkout).
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/staff/dashboard">Volver</Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Disponibilidad</CardTitle>
              <CardDescription>
                Si desactivas pedidos, los clientes verán un aviso y no podrán completar checkout.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrderingSettingsPanel />
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

