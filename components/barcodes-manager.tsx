"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import QRCode from "react-qr-code"
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { resolveBarcodeScanUrl } from "@/lib/resolve-barcode-scan-url"
import type { SiteBarcodeRow } from "@/lib/site-barcodes-types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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

function sortRows(list: SiteBarcodeRow[]): SiteBarcodeRow[] {
  return [...list].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.id.localeCompare(b.id)
  })
}

export function BarcodesManager({
  baseUrl,
  initialRows,
}: {
  baseUrl: string
  initialRows: SiteBarcodeRow[]
}) {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [rows, setRows] = useState<SiteBarcodeRow[]>(() => sortRows(initialRows))
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    setRows(sortRows(initialRows))
  }, [initialRows])

  const refetch = useCallback(async () => {
    setError(null)
    const { data, error: qErr } = await supabase
      .from("site_barcodes")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
    if (qErr) {
      setError(qErr.message)
      return
    }
    setRows(sortRows((data ?? []) as SiteBarcodeRow[]))
  }, [supabase])

  const updateField = useCallback(
    (id: string, patch: Partial<Pick<SiteBarcodeRow, "label" | "target_url">>) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      )
    },
    [],
  )

  const saveRow = async (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    setBusyId(id)
    setError(null)
    const { error: uErr } = await supabase
      .from("site_barcodes")
      .update({
        label: row.label.trim() || "Sin título",
        target_url: row.target_url.trim() || "/",
      })
      .eq("id", id)
    setBusyId(null)
    if (uErr) {
      setError(uErr.message)
      return
    }
    await refetch()
  }

  const setEnabled = async (id: string, enabled: boolean) => {
    setBusyId(id)
    setError(null)
    const { error: uErr } = await supabase
      .from("site_barcodes")
      .update({ enabled })
      .eq("id", id)
    setBusyId(null)
    if (uErr) {
      setError(uErr.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)))
  }

  const removeRow = async (id: string) => {
    setBusyId(id)
    setError(null)
    const { error: dErr } = await supabase.from("site_barcodes").delete().eq("id", id)
    setBusyId(null)
    if (dErr) {
      setError(dErr.message)
      return
    }
    await refetch()
  }

  const addRow = async () => {
    setError(null)
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), -1)
    const { error: iErr } = await supabase.from("site_barcodes").insert({
      label: "Nuevo código",
      target_url: "/",
      enabled: true,
      sort_order: maxOrder + 1,
    })
    if (iErr) {
      setError(iErr.message)
      return
    }
    await refetch()
  }

  const moveRow = async (id: string, dir: -1 | 1) => {
    const sorted = sortRows(rows)
    const idx = sorted.findIndex((r) => r.id === id)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[j]
    setBusyId(id)
    setError(null)
    const u1 = await supabase
      .from("site_barcodes")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id)
    if (u1.error) {
      setError(u1.error.message)
      setBusyId(null)
      return
    }
    const u2 = await supabase
      .from("site_barcodes")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id)
    setBusyId(null)
    if (u2.error) {
      setError(u2.error.message)
      return
    }
    await refetch()
  }

  const copyResolved = async (target: string) => {
    const url = resolveBarcodeScanUrl(baseUrl, target)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      setError("No se pudo copiar al portapapeles.")
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xl">
          Cada entrada genera un código QR para imprimir o pantalla. Puedes usar una ruta del sitio
          (por ejemplo <code className="text-xs bg-muted px-1 rounded">/</code> o{" "}
          <code className="text-xs bg-muted px-1 rounded">/cuenta/ofertas</code>) o un enlace
          completo (https://…). Desactiva los que no necesites sin borrarlos.
        </p>
        <Button type="button" onClick={() => void addRow()} variant="default" size="sm">
          <Plus className="size-4 mr-1.5" aria-hidden />
          Añadir código
        </Button>
      </div>

      <ul className="space-y-6 list-none p-0 m-0">
        {sortRows(rows).map((row, index, arr) => {
          const resolved = resolveBarcodeScanUrl(baseUrl, row.target_url)
          const disabled = busyId === row.id
          return (
            <li key={row.id}>
              <Card className={!row.enabled ? "opacity-75 border-dashed" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Código QR</CardTitle>
                      <CardDescription className="font-mono text-xs break-all">
                        {resolved}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`en-${row.id}`}
                          checked={row.enabled}
                          disabled={disabled}
                          onCheckedChange={(v) => void setEnabled(row.id, v)}
                        />
                        <Label htmlFor={`en-${row.id}`} className="text-sm cursor-pointer">
                          Activo
                        </Label>
                      </div>
                      <div className="flex items-center gap-0.5 border rounded-md">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={disabled || index === 0}
                          onClick={() => void moveRow(row.id, -1)}
                          aria-label="Subir en la lista"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={disabled || index === arr.length - 1}
                          onClick={() => void moveRow(row.id, 1)}
                          aria-label="Bajar en la lista"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => void copyResolved(row.target_url)}
                      >
                        <Copy className="size-3.5 mr-1" aria-hidden />
                        Copiar enlace
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/50 hover:bg-destructive/10"
                            disabled={disabled}
                          >
                            <Trash2 className="size-3.5 mr-1" aria-hidden />
                            Eliminar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar este código?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se borrará la entrada y ya no aparecerá en esta lista. Puedes volver a
                              crear una nueva cuando quieras.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => void removeRow(row.id)}
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="space-y-4 max-w-lg">
                    <div className="space-y-2">
                      <Label htmlFor={`label-${row.id}`}>Etiqueta (solo para ti)</Label>
                      <Input
                        id={`label-${row.id}`}
                        value={row.label}
                        disabled={disabled}
                        onChange={(e) => updateField(row.id, { label: e.target.value })}
                        placeholder="Ej. Oferta fin de semana"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`url-${row.id}`}>Ruta o URL</Label>
                      <Input
                        id={`url-${row.id}`}
                        value={row.target_url}
                        disabled={disabled}
                        onChange={(e) => updateField(row.id, { target_url: e.target.value })}
                        placeholder="/ o https://…"
                        className="font-mono text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={disabled}
                      onClick={() => void saveRow(row.id)}
                    >
                      Guardar cambios
                    </Button>
                  </div>
                  <div className="flex flex-col items-center gap-2 md:pt-0">
                    {row.enabled ? (
                      <>
                        <div className="rounded-lg border bg-white p-3 shadow-sm">
                          <QRCode value={resolved} size={200} level="M" />
                        </div>
                        <p className="text-xs text-muted-foreground text-center max-w-[220px]">
                          Escaneo → {row.label}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground italic text-center py-8 px-4 border rounded-lg bg-muted/30 max-w-[220px]">
                        Desactivado: no uses este código en material impreso hasta que lo actives.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay códigos. Pulsa &quot;Añadir código&quot; o aplica la migración SQL si la tabla aún no
          existe.
        </p>
      ) : null}
    </div>
  )
}
