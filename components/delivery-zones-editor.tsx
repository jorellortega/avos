"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  DELIVERY_ZONES_KEY,
  defaultDeliveryZonesJson,
  serializeDeliveryZonesJson,
  slugifyZoneId,
  type DeliveryZone,
  type DeliveryZonesJson,
} from "@/lib/delivery-zones"

function cloneJson(j: DeliveryZonesJson): DeliveryZonesJson {
  return {
    cityLabel: j.cityLabel,
    zones: j.zones.map((z) => ({ ...z })),
  }
}

type Props = {
  initial: DeliveryZonesJson
}

export function DeliveryZonesEditor({ initial }: Props) {
  const [state, setState] = useState(() => cloneJson(initial))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )

  const updateZone = (index: number, patch: Partial<DeliveryZone>) => {
    setState((s) => {
      const next = cloneJson(s)
      next.zones[index] = { ...next.zones[index], ...patch }
      return next
    })
  }

  const removeZone = (index: number) => {
    setState((s) => {
      const next = cloneJson(s)
      next.zones.splice(index, 1)
      return next
    })
  }

  const addZone = () => {
    const id = `zona-${Date.now().toString(36).slice(-4)}`
    setState((s) => ({
      ...s,
      zones: [
        ...s.zones,
        {
          id,
          label: "Nueva zona",
          hint: "",
          fee: 40,
          enabled: true,
          mapRow: 1,
          mapCol: 1,
        },
      ],
    }))
  }

  const save = useCallback(async () => {
    setSaving(true)
    setMessage(null)
    try {
      const supabase = createBrowserSupabase()
      const { error } = await supabase
        .from("ai_settings")
        .update({ setting_value: serializeDeliveryZonesJson(state) })
        .eq("setting_key", DELIVERY_ZONES_KEY)

      if (error) throw error
      setMessage({ ok: true, text: "Guardado." })
    } catch (e) {
      setMessage({
        ok: false,
        text:
          e instanceof Error ? e.message : "No se pudo guardar (solo CEO).",
      })
    } finally {
      setSaving(false)
    }
  }, [state])

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Envío a domicilio
          </h1>
          <p className="text-muted-foreground mt-1">
            Tarifas por colonia en Pastor Ortiz. Los clientes las ven en{" "}
            <Link href="/domicilio" className="text-primary underline">
              /domicilio
            </Link>
            .
          </p>
        </div>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Guardar
        </Button>
      </div>

      {message ? (
        <p
          className={
            message.ok ? "text-sm text-green-700" : "text-sm text-destructive"
          }
        >
          {message.text}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ciudad</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="city-label">Nombre mostrado al cliente</Label>
          <Input
            id="city-label"
            className="mt-1.5"
            value={state.cityLabel}
            onChange={(e) =>
              setState((s) => ({ ...s, cityLabel: e.target.value }))
            }
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {state.zones.map((zone, index) => (
          <Card key={zone.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{zone.label}</CardTitle>
                  <CardDescription>
                    ID: <code className="text-xs">{zone.id}</code>
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => removeZone(index)}
                  aria-label="Eliminar zona"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nombre de la zona</Label>
                  <Input
                    className="mt-1"
                    value={zone.label}
                    onChange={(e) => {
                      const label = e.target.value
                      updateZone(index, {
                        label,
                        id:
                          zone.id.startsWith("zona-") || zone.id.length < 3
                            ? slugifyZoneId(label) || zone.id
                            : zone.id,
                      })
                    }}
                  />
                </div>
                <div>
                  <Label>Tarifa de envío (MXN)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    step={1}
                    value={zone.fee}
                    onChange={(e) =>
                      updateZone(index, {
                        fee: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Descripción corta</Label>
                <Input
                  className="mt-1"
                  value={zone.hint}
                  onChange={(e) => updateZone(index, { hint: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-xs">
                <div>
                  <Label>Fila en mapa (0–4)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    max={4}
                    value={zone.mapRow}
                    onChange={(e) =>
                      updateZone(index, {
                        mapRow: Math.min(4, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Columna (0–4)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    max={4}
                    value={zone.mapCol}
                    onChange={(e) =>
                      updateZone(index, {
                        mapCol: Math.min(4, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`enabled-${zone.id}`}
                  checked={zone.enabled}
                  onCheckedChange={(c) =>
                    updateZone(index, { enabled: c === true })
                  }
                />
                <Label htmlFor={`enabled-${zone.id}`} className="font-normal">
                  Disponible para pedidos
                </Label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addZone}>
        <Plus className="h-4 w-4 mr-2" />
        Agregar zona
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => setState(cloneJson(defaultDeliveryZonesJson()))}
      >
        Restaurar valores predeterminados (sin guardar)
      </Button>
    </div>
  )
}
