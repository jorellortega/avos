"use client"

import { useCallback, useEffect, useState } from "react"
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type CajaSummary,
  ceoStartCajaShift,
  fetchCajaSummaryClient,
  formatCajaMoney,
} from "@/lib/register-change-float"

const VISIBILITY_KEY = "avos-staff-caja-summary-visible"

type StaffOrdenesCajaSummaryProps = {
  isCeo: boolean
  /** Server-rendered snapshot (optional); client refreshes on mount. */
  initialSummary?: CajaSummary | null
}

function formatShiftStart(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

function RevenueBlock({
  title,
  bucket,
}: {
  title: string
  bucket: CajaSummary["today"]
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <dl className="grid grid-cols-1 gap-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Efectivo</dt>
          <dd className="font-medium tabular-nums">{formatCajaMoney(bucket.efectivo)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Tarjeta</dt>
          <dd className="font-medium tabular-nums">{formatCajaMoney(bucket.tarjeta)}</dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-border/60 pt-1.5">
          <dt className="font-medium">Total cobrado</dt>
          <dd className="font-bold tabular-nums">{formatCajaMoney(bucket.total)}</dd>
        </div>
      </dl>
    </div>
  )
}

export function StaffOrdenesCajaSummary({
  isCeo,
  initialSummary = null,
}: StaffOrdenesCajaSummaryProps) {
  const [visible, setVisible] = useState(false)
  const [summary, setSummary] = useState<CajaSummary | null>(initialSummary)
  const [loading, setLoading] = useState(false)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(VISIBILITY_KEY) === "1")
    } catch {
      setVisible(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { summary: next, error: err } = await fetchCajaSummaryClient()
    setLoading(false)
    if (err) setError(err)
    if (next) setSummary(next)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleVisible = () => {
    const next = !visible
    setVisible(next)
    try {
      localStorage.setItem(VISIBILITY_KEY, next ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  const startShift = async () => {
    if (!isCeo || shiftLoading) return
    setShiftLoading(true)
    const result = await ceoStartCajaShift()
    setShiftLoading(false)
    if (!result.ok) {
      setError(result.error ?? "No se pudo iniciar turno.")
      return
    }
    await load()
  }

  const fondo = summary?.registerChangeFloat ?? 0
  const efectivoEnCajaEst =
    fondo + (summary?.shift.efectivo ?? 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={toggleVisible}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
          {visible ? "Ocultar resumen de caja" : "Mostrar resumen de caja"}
        </Button>
        {visible ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualizar
          </Button>
        ) : null}
        {isCeo && visible ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={shiftLoading}
            onClick={() => void startShift()}
          >
            {shiftLoading ? "…" : "Nuevo turno"}
          </Button>
        ) : null}
      </div>

      <Card className="border-primary/25 bg-primary/5">
        <CardHeader className="pb-2">
          <CardDescription>Fondo en caja para cambio</CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {formatCajaMoney(fondo)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>
            Lo que el CEO dejó en la caja para dar cambio. Todo el personal lo ve
            igual en portal y aquí.
          </p>
          {fondo <= 0 ? (
            <p className="text-amber-700 dark:text-amber-300">
              Aún no hay fondo configurado — el CEO puede ponerlo en{" "}
              <strong>/portal</strong>.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {visible ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Cobros confirmados</CardTitle>
            <CardDescription>
              Solo pagos con cobro confirmado (efectivo o tarjeta en caja).
              {summary?.shiftStartedAt ? (
                <span className="block mt-1">
                  Turno desde: {formatShiftStart(summary.shiftStartedAt)}
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {summary ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RevenueBlock title="Hoy (día)" bucket={summary.today} />
                  <RevenueBlock title="Turno actual" bucket={summary.shift} />
                </div>
                <div className="rounded-lg border border-green-600/30 bg-green-500/5 p-3 text-sm space-y-1">
                  <p className="font-medium text-green-900 dark:text-green-200">
                    Efectivo estimado en caja (turno)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fondo para cambio + efectivo cobrado en el turno (referencia, no
                    incluye retiros).
                  </p>
                  <p className="text-xl font-bold tabular-nums text-green-800 dark:text-green-300">
                    {formatCajaMoney(efectivoEnCajaEst)}
                  </p>
                </div>
              </>
            ) : loading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
