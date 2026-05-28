import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StaffSignOutButton } from "@/components/staff-sign-out-button"
import { StaffOrdenesHistoryTable } from "@/components/staff-ordenes-history-table"
import { StaffOrdenesCajaSummary } from "@/components/staff-ordenes-caja-summary"
import { parseCajaSummary } from "@/lib/register-change-float"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isCeo, isStaffOrdersRole } from "@/lib/profile-types"
import type { StaffOrdenesOrderRow } from "@/lib/staff-ordenes-types"

export const dynamic = "force-dynamic"

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n)
}

export default async function StaffOrdenesPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/staff/ordenes")
  }

  const first = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  let profileRow = first.data

  if (user && profileRow == null) {
    await supabase.rpc("ensure_my_public_user")
    const second = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
    profileRow = second.data
  }

  const profile = profileRow as StaffProfile | null

  if (!profile || !isStaffOrdersRole(profile.role)) {
    redirect("/staff/dashboard")
  }

  const { data: rows, error } = await supabase
    .from("avos_orders")
    .select(
      "id,numero,total,status,order_type,mesa,nombre_cliente,payment_method,paid_at,created_at,delivery_zone_id,delivery_address,delivery_photo_street_url,delivery_photo_house_url",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  const list = (rows ?? []) as StaffOrdenesOrderRow[]
  const ceo = isCeo(profile.role)

  const { data: cajaRaw } = await supabase.rpc("staff_get_caja_summary")
  const initialCajaSummary = parseCajaSummary(cajaRaw)

  let sumEfectivo = 0
  let sumTarjeta = 0
  let sumPendienteCaja = 0
  let countPendienteCaja = 0
  for (const r of list) {
    const t = Number(r.total)
    if (!r.paid_at) {
      sumPendienteCaja += t
      countPendienteCaja += 1
      continue
    }
    if (r.payment_method === "efectivo") sumEfectivo += t
    if (r.payment_method === "tarjeta") sumTarjeta += t
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-10 md:py-14">
        <div className="container mx-auto px-4 max-w-6xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1
                className="text-3xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Órdenes y pagos
              </h1>
              <p className="text-muted-foreground mt-1">
                En mesa el cliente puede marcar “pago en caja” o pagar en línea; tú
                registras efectivo o tarjeta al cobrar. Los totales solo cuentan pagos
                confirmados.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/staff/dashboard">Panel</Link>
              </Button>
              <StaffSignOutButton />
            </div>
          </div>

          {error && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-lg text-destructive">
                  No se pudieron cargar las órdenes
                </CardTitle>
                <CardDescription>{error.message}</CardDescription>
              </CardHeader>
            </Card>
          )}

          {!error && (
            <>
              <StaffOrdenesCajaSummary
                isCeo={ceo}
                initialSummary={initialCajaSummary}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total efectivo (confirmado)</CardDescription>
                    <CardTitle className="text-2xl text-foreground">
                      {formatMoney(sumEfectivo)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total tarjeta (confirmado)</CardDescription>
                    <CardTitle className="text-2xl text-foreground">
                      {formatMoney(sumTarjeta)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card
                  className={
                    countPendienteCaja > 0
                      ? "border-amber-300/80 bg-amber-50/50 dark:bg-amber-950/20"
                      : undefined
                  }
                >
                  <CardHeader className="pb-2">
                    <CardDescription>
                      Por confirmar en caja ({countPendienteCaja})
                    </CardDescription>
                    <CardTitle className="text-2xl text-foreground">
                      {formatMoney(sumPendienteCaja)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Registros mostrados</CardDescription>
                    <CardTitle className="text-2xl text-foreground">
                      {list.length}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
              {countPendienteCaja > 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 rounded-md px-3 py-2">
                  Hay {countPendienteCaja} orden(es) sin cobro confirmado. El estado
                  &quot;pagado&quot; en portal no cuenta en caja hasta que pulses{" "}
                  <strong>Confirmar pago</strong> (efectivo o tarjeta) en la tabla.
                </p>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Historial</CardTitle>
                  <CardDescription>
                    Hasta 200 órdenes recientes. &quot;En caja&quot; = el cliente va a
                    pagar en mostrador; elige efectivo o tarjeta al cobrar.
                    {ceo
                      ? " Como CEO puedes seleccionar varias y eliminarlas, o editar una por una."
                      : null}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StaffOrdenesHistoryTable orders={list} isCeo={ceo} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
