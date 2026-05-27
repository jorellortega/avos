"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import type { StaffOrdenesOrderRow } from "@/lib/staff-ordenes-types"
import { StaffConfirmPaymentButton } from "@/components/staff-confirm-payment-button"
import { StaffOrdenesCeoActions } from "@/components/staff-ordenes-ceo-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

function orderTypeLabel(t: string) {
  if (t === "mesa") return "Mesa"
  if (t === "domicilio") return "Domicilio"
  return "Para llevar"
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

type StaffOrdenesHistoryTableProps = {
  orders: StaffOrdenesOrderRow[]
  isCeo: boolean
}

export function StaffOrdenesHistoryTable({
  orders,
  isCeo,
}: StaffOrdenesHistoryTableProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const allIds = useMemo(() => orders.map((o) => o.id), [orders])
  const allSelected =
    orders.length > 0 && selected.size === orders.length
  const someSelected = selected.size > 0 && !allSelected

  const selectedNumeros = useMemo(
    () =>
      orders
        .filter((o) => selected.has(o.id))
        .map((o) => o.numero)
        .sort((a, b) => a - b),
    [orders, selected],
  )

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allIds) : new Set())
  }

  async function bulkDelete() {
    const orderIds = [...selected]
    if (orderIds.length === 0) return

    setBulkDeleting(true)
    setBulkError(null)
    try {
      const res = await fetch("/api/staff/ordenes/delete-many", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds }),
      })
      const data = (await res.json()) as {
        error?: string
        deleted?: number
      }
      if (!res.ok) {
        setBulkError(data.error ?? "No se pudo eliminar.")
        return
      }
      setSelected(new Set())
      setBulkConfirmOpen(false)
      router.refresh()
    } catch {
      setBulkError("Error de red.")
    } finally {
      setBulkDeleting(false)
    }
  }

  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aún no hay órdenes en la base de datos.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {isCeo && selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-sm font-medium">
            {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {bulkError && (
              <span className="text-xs text-destructive">{bulkError}</span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelected(new Set())
                setBulkError(null)
              }}
            >
              Quitar selección
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1"
              disabled={bulkDeleting}
              onClick={() => setBulkConfirmOpen(true)}
            >
              {bulkDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Eliminar seleccionadas
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {isCeo && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(v === true)}
                  aria-label="Seleccionar todas"
                />
              </TableHead>
            )}
            <TableHead>#</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Mesa</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Caja</TableHead>
            {isCeo && (
              <TableHead className="text-right w-[100px]">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((r) => {
            const isRowSelected = selected.has(r.id)
            return (
              <TableRow
                key={r.id}
                className={cn(isRowSelected && isCeo && "bg-primary/5")}
              >
                {isCeo && (
                  <TableCell>
                    <Checkbox
                      checked={isRowSelected}
                      onCheckedChange={(v) => toggleOne(r.id, v === true)}
                      aria-label={`Seleccionar orden ${r.numero}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">#{r.numero}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(r.created_at)}
                </TableCell>
                <TableCell>{orderTypeLabel(r.order_type)}</TableCell>
                <TableCell className="max-w-[140px]">
                  {r.order_type === "domicilio" ? (
                    <div className="space-y-1">
                      <span className="text-xs block truncate">
                        {r.delivery_zone_id ?? "—"}
                      </span>
                      {r.delivery_address ? (
                        <span className="text-[10px] text-muted-foreground line-clamp-2 block">
                          {r.delivery_address}
                        </span>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {r.delivery_photo_street_url ? (
                          <a
                            href={r.delivery_photo_street_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline"
                          >
                            Foto calle
                          </a>
                        ) : null}
                        {r.delivery_photo_house_url ? (
                          <a
                            href={r.delivery_photo_house_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline"
                          >
                            Foto casa
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    (r.mesa ?? "—")
                  )}
                </TableCell>
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
                      <span className="text-xs text-green-600 ml-1">Pagado</span>
                    </div>
                  ) : r.payment_method === "caja" ? (
                    <Badge
                      variant="outline"
                      className="text-amber-800 border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                    >
                      En caja (pendiente)
                    </Badge>
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
                  <span className="text-xs text-muted-foreground">{r.status}</span>
                </TableCell>
                <TableCell className="text-right">
                  {!r.paid_at ? (
                    <StaffConfirmPaymentButton
                      orderId={r.id}
                      intentMethod={r.payment_method}
                      orderType={r.order_type}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                {isCeo && (
                  <TableCell className="text-right align-top">
                    <StaffOrdenesCeoActions order={r} />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {selected.size} orden
              {selected.size === 1 ? "" : "es"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Se borrarán del historial y de cocina. No se puede deshacer.</p>
                {selectedNumeros.length > 0 && selectedNumeros.length <= 12 && (
                  <p className="text-sm">
                    Órdenes: #
                    {selectedNumeros.join(", #")}
                  </p>
                )}
                {selectedNumeros.length > 12 && (
                  <p className="text-sm">
                    Órdenes: #{selectedNumeros.slice(0, 8).join(", #")} y{" "}
                    {selectedNumeros.length - 8} más…
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleting}
              onClick={(e) => {
                e.preventDefault()
                void bulkDelete()
              }}
            >
              {bulkDeleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
