"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type Row = {
  ordering_enabled: boolean
  closed_message: string
}

export function OrderingSettingsPanel() {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      setError(null)
      setSaved(false)
      const { data, error: e } = await supabase
        .from("ordering_settings")
        .select("ordering_enabled, closed_message")
        .eq("id", 1)
        .maybeSingle()
      setLoading(false)
      if (e) {
        setError(e.message)
        return
      }
      const row = (data ?? { ordering_enabled: true, closed_message: "" }) as Row
      setEnabled(Boolean(row.ordering_enabled))
      setMessage(String(row.closed_message ?? ""))
    })()
  }, [supabase])

  async function save() {
    setError(null)
    setSaved(false)
    setSaving(true)
    const { error: e } = await supabase
      .from("ordering_settings")
      .update({
        ordering_enabled: enabled,
        closed_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
    setSaving(false)
    if (e) {
      setError(e.message)
      return
    }
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch id="ordering-enabled" checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor="ordering-enabled" className="cursor-pointer">
          Pedidos habilitados
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="closed-message">Mensaje cuando esté cerrado (opcional)</Label>
        <Input
          id="closed-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ej. Estamos cerrados por mantenimiento. Vuelve a intentar a las 11:00."
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {saved ? (
        <Alert>
          <AlertTitle>Guardado</AlertTitle>
          <AlertDescription>Se actualizó la disponibilidad de pedidos.</AlertDescription>
        </Alert>
      ) : null}

      <Button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  )
}

