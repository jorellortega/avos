"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import type { StaffOrdenesOrderRow } from "@/lib/staff-ordenes-types"

export type StaffOrdenesListRow = StaffOrdenesOrderRow

type OrderItemLine = {
  nombre?: string
  precio?: number
  cantidad?: number
  notas?: string
}

type OrderDetail = StaffOrdenesListRow & {
  items?: OrderItemLine[]
  delivery_zone_id?: string | null
  delivery_address?: string | null
  delivery_fee?: number | null
}

type StaffOrdenesCeoActionsProps = {
  order: StaffOrdenesListRow
}

export function StaffOrdenesCeoActions({ order }: StaffOrdenesCeoActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetail | null>(null)

  const [total, setTotal] = useState("")
  const [status, setStatus] = useState("pendiente")
  const [orderType, setOrderType] = useState("mesa")
  const [mesa, setMesa] = useState("")
  const [nombreCliente, setNombreCliente] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("__none__")
  const [markPaid, setMarkPaid] = useState(false)

  function resetFormFrom(d: OrderDetail) {
    setTotal(String(Number(d.total)))
    setStatus(d.status)
    setOrderType(d.order_type)
    setMesa(d.mesa ?? "")
    setNombreCliente(d.nombre_cliente ?? "")
    setPaymentMethod(d.payment_method ?? "__none__")
    setMarkPaid(Boolean(d.paid_at))
  }

  async function openEdit() {
    setEditOpen(true)
    setError(null)
    setLoadingDetail(true)
    try {
      const res = await fetch(
        `/api/staff/ordenes/detail?orderId=${encodeURIComponent(order.id)}`,
      )
      const data = (await res.json()) as { error?: string; order?: OrderDetail }
      if (!res.ok || !data.order) {
        setError(data.error ?? "No se pudo cargar la orden.")
        return
      }
      setDetail(data.order)
      resetFormFrom(data.order)
    } catch {
      setError("Error de red.")
    } finally {
      setLoadingDetail(false)
    }
  }

  async function saveEdit() {
    setSaving(true)
    setError(null)
    const totalNum = Number.parseFloat(total)
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      setError("Total no válido.")
      setSaving(false)
      return
    }

    const hadPaid = Boolean(detail?.paid_at)
    let paidAt: string | null | undefined = undefined
    if (markPaid && !hadPaid) {
      paidAt = new Date().toISOString()
    } else if (!markPaid && hadPaid) {
      paidAt = null
    }

    try {
      const res = await fetch("/api/staff/ordenes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          total: totalNum,
          status,
          order_type: orderType,
          mesa: mesa || null,
          nombre_cliente: nombreCliente || null,
          payment_method:
            paymentMethod === "__none__" ? null : paymentMethod,
          ...(paidAt !== undefined ? { paid_at: paidAt } : {}),
        }),
      })
      const data = (await res.json()) as { error?: string; ok?: boolean }
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar.")
        return
      }
      setEditOpen(false)
      router.refresh()
    } catch {
      setError("Error de red.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteOrder() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch("/api/staff/ordenes/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      })
      const data = (await res.json()) as { error?: string; ok?: boolean }
      if (!res.ok) {
        setError(data.error ?? "No se pudo eliminar.")
        return
      }
      router.refresh()
    } catch {
      setError("Error de red.")
    } finally {
      setDeleting(false)
    }
  }

  const items = Array.isArray(detail?.items) ? detail.items : []

  return (
    <div className="flex flex-col items-end gap-1">
      {error && !editOpen && (
        <span className="text-xs text-destructive max-w-[160px] text-right">
          {error}
        </span>
      )}
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          title="Editar orden"
          onClick={() => void openEdit()}
        >
          <Pencil className="size-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              title="Eliminar orden"
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Eliminar orden #{order.numero}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Se borrará del historial y de cocina. No se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void deleteOrder()}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar orden #{order.numero}</DialogTitle>
            <DialogDescription>
              Solo CEO. Para cambiar artículos, usa{" "}
              <Link
                href={`/orden/${order.numero}`}
                className="underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                /orden/{order.numero}
              </Link>{" "}
              o el portal si aplica.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`total-${order.id}`}>Total (MXN)</Label>
                  <Input
                    id={`total-${order.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="preparando">Preparando</SelectItem>
                      <SelectItem value="listo">Listo</SelectItem>
                      <SelectItem value="entregado">Entregado</SelectItem>
                      <SelectItem value="pagado">Pagado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mesa">Mesa</SelectItem>
                      <SelectItem value="pickup">Para llevar</SelectItem>
                      <SelectItem value="domicilio">Domicilio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Método de pago</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin indicar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin indicar</SelectItem>
                      <SelectItem value="caja">En caja</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`mesa-${order.id}`}>Mesa</Label>
                  <Input
                    id={`mesa-${order.id}`}
                    value={mesa}
                    onChange={(e) => setMesa(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`cliente-${order.id}`}>Cliente</Label>
                  <Input
                    id={`cliente-${order.id}`}
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={markPaid}
                  onChange={(e) => setMarkPaid(e.target.checked)}
                  className="rounded border-input"
                />
                Pagado (registra fecha de pago al guardar si antes no estaba)
              </label>

              {items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Artículos</p>
                  <ul className="text-sm border rounded-md divide-y max-h-40 overflow-y-auto">
                    {items.map((line, i) => (
                      <li key={i} className="px-3 py-2">
                        <span className="font-medium">
                          {line.cantidad ?? 1}× {line.nombre ?? "—"}
                        </span>
                        {line.notas ? (
                          <span className="text-muted-foreground text-xs block">
                            {line.notas}
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground block">
                          ${Number(line.precio ?? 0).toFixed(2)} c/u
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void saveEdit()}
              disabled={saving || loadingDetail}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
