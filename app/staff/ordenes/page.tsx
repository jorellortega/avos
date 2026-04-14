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
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StaffSignOutButton } from "@/components/staff-sign-out-button"
import { StaffConfirmPaymentButton } from "@/components/staff-confirm-payment-button"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isStaffOrdersRole } from "@/lib/profile-types"

export const dynamic = "force-dynamic"

type AvosOrderRow = {
  id: string
  numero: number
  total: number
  status: string
  order_type: string
  mesa: string | null
  nombre_cliente: string | null
  payment_method: string | null
  paid_at: string | null
  created_at: string
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  })
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
      "id,numero,total,status,order_type,mesa,nombre_cliente,payment_method,paid_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  const list = (rows ?? []) as AvosOrderRow[]

  let sumEfectivo = 0
  let sumTarjeta = 0
  for (const r of list) {
    if (!r.paid_at) continue
    const t = Number(r.total)
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
                El cliente puede indicar efectivo o tarjeta; aquí confirmas cuando
                cobras. Los totales solo cuentan pagos confirmados.
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total efectivo (pagado)</CardDescription>
                    <CardTitle className="text-2xl text-foreground">
                      {formatMoney(sumEfectivo)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total tarjeta (pagado)</CardDescription>
                    <CardTitle className="text-2xl text-foreground">
                      {formatMoney(sumTarjeta)}
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Historial</CardTitle>
                  <CardDescription>
                    Hasta 200 órdenes recientes. &quot;Pendiente&quot; = el cliente
                    ya indicó forma de pago; usa Confirmar pago cuando recibas el
                    dinero.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Aún no hay órdenes en la base de datos.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Mesa</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Caja</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              #{r.numero}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(r.created_at)}
                            </TableCell>
                            <TableCell>
                              {r.order_type === "mesa" ? "Mesa" : "Para llevar"}
                            </TableCell>
                            <TableCell>{r.mesa ?? "—"}</TableCell>
                            <TableCell className="max-w-[140px] truncate">
                              {r.nombre_cliente ?? "—"}
                            </TableCell>
                            <TableCell>{formatMoney(Number(r.total))}</TableCell>
                            <TableCell>
                              {r.paid_at ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  {r.payment_method === "efectivo" && (
                                    <Badge variant="secondary">Efectivo</Badge>
                                  )}
                                  {r.payment_method === "tarjeta" && (
                                    <Badge variant="outline">Tarjeta</Badge>
                                  )}
                                  <span className="text-xs text-green-600 ml-1">
                                    Pagado
                                  </span>
                                </div>
                              ) : r.payment_method ? (
                                <Badge
                                  variant="outline"
                                  className="text-amber-800 border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                                >
                                  Pendiente ({r.payment_method})
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  Sin indicar
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {r.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {!r.paid_at ? (
                                <StaffConfirmPaymentButton
                                  orderId={r.id}
                                  intentMethod={r.payment_method}
                                  orderType={r.order_type}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
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
