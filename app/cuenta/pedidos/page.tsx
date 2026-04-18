import Link from "next/link"
import { createServerSupabase } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type OrderRow = {
  id: string
  numero: number
  total: number
  status: string
  order_type: string
  created_at: string
  paid_at: string | null
}

const statusLabel: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  preparando: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n)
}

export default async function CuentaPedidosPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: rows, error } = await supabase
    .from("avos_orders")
    .select("id,numero,total,status,order_type,created_at,paid_at")
    .eq("customer_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)

  const list = (rows ?? []) as OrderRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Mis pedidos
        </h1>
        <p className="text-muted-foreground mt-1">
          Pedidos vinculados a tu cuenta (después de iniciar sesión al ordenar).
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}

      {!error && list.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aún no hay pedidos</CardTitle>
            <CardDescription>
              Cuando hagas un pedido con la sesión iniciada, aparecerá aquí. También
              puedes seguir un pedido por número en{" "}
              <Link href="/orden" className="text-primary underline-offset-4 hover:underline">
                Mi orden
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <ul className="space-y-3">
        {list.map((o) => (
          <li key={o.id}>
            <Card>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-lg">Pedido #{o.numero}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {o.order_type === "pickup" ? "Para llevar" : "En mesa"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{statusLabel[o.status] ?? o.status}</Badge>
                  <span className="font-medium">{formatMoney(Number(o.total))}</span>
                  <Link
                    href={`/orden/${o.numero}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Ver estado
                  </Link>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
