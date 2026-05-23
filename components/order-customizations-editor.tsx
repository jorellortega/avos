"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { categorias, getPlatillosForCategoria } from "@/lib/menu-data"
import { catalogPlatilloKey } from "@/lib/menu-catalog-shared"
import {
  ORDER_CUSTOMIZATIONS_KEY,
  defaultOrderCustomizationsJson,
  defaultPlatilloCustomizationConfig,
  slugifyCustomizeOptionId,
  serializeOrderCustomizationsJson,
  type CustomizeOptionDef,
  type OrderCustomizationsJson,
  type PlatilloCustomizationConfig,
} from "@/lib/order-item-customizations"
import { useOrderCustomizationsContextOptional } from "@/components/order-customizations-provider"

function cloneConfig(c: PlatilloCustomizationConfig): PlatilloCustomizationConfig {
  return {
    defaultLabel: c.defaultLabel,
    defaultId: c.defaultId,
    options: c.options.map((o) => ({ ...o })),
  }
}

function cloneJson(j: OrderCustomizationsJson): OrderCustomizationsJson {
  return {
    global: cloneConfig(j.global),
    byPlatillo: Object.fromEntries(
      Object.entries(j.byPlatillo).map(([k, v]) => [k, cloneConfig(v)]),
    ),
  }
}

type PlatilloTarget = {
  key: string
  categoriaId: string
  platilloId: string
  label: string
  usesGlobal: boolean
}

type Props = {
  initial: OrderCustomizationsJson
}

export function OrderCustomizationsEditor({ initial }: Props) {
  const ctx = useOrderCustomizationsContextOptional()
  const [state, setState] = useState(() => cloneJson(initial))
  const [selectedKey, setSelectedKey] = useState<string>("__global__")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  const [newOptionLabel, setNewOptionLabel] = useState("")

  const targets = useMemo((): PlatilloTarget[] => {
    const list: PlatilloTarget[] = [
      {
        key: "__global__",
        categoriaId: "",
        platilloId: "",
        label: "Global (predeterminado)",
        usesGlobal: true,
      },
    ]
    for (const cat of categorias) {
      for (const p of getPlatillosForCategoria(cat)) {
        const key = catalogPlatilloKey(cat.id, p.id)
        list.push({
          key,
          categoriaId: cat.id,
          platilloId: p.id,
          label: `${cat.nombre} — ${p.nombre}`,
          usesGlobal: !state.byPlatillo[key],
        })
      }
    }
    return list
  }, [state.byPlatillo])

  const selected = targets.find((t) => t.key === selectedKey) ?? targets[0]

  const activeConfig: PlatilloCustomizationConfig =
    selected.key === "__global__"
      ? state.global
      : (state.byPlatillo[selected.key] ?? state.global)

  const isEditingOverride = selected.key !== "__global__" && Boolean(state.byPlatillo[selected.key])

  const setActiveConfig = (next: PlatilloCustomizationConfig) => {
    setState((s) => {
      const copy = cloneJson(s)
      if (selected.key === "__global__") {
        copy.global = next
        return copy
      }
      copy.byPlatillo[selected.key] = next
      return copy
    })
  }

  const enableOverride = () => {
    setState((s) => {
      const copy = cloneJson(s)
      copy.byPlatillo[selected.key] = cloneConfig(s.global)
      return copy
    })
  }

  const useGlobalForPlatillo = () => {
    setState((s) => {
      const copy = cloneJson(s)
      delete copy.byPlatillo[selected.key]
      return copy
    })
  }

  const addOption = () => {
    const label = newOptionLabel.trim()
    if (!label) return
    let id = slugifyCustomizeOptionId(label)
    if (!id || id === activeConfig.defaultId) {
      id = `${id || "opcion"}-${Date.now().toString(36).slice(-4)}`
    }
    if (activeConfig.options.some((o) => o.id === id)) {
      id = `${id}-${activeConfig.options.length + 1}`
    }
    const opt: CustomizeOptionDef = { id, label }
    setActiveConfig({
      ...activeConfig,
      options: [...activeConfig.options, opt],
    })
    setNewOptionLabel("")
  }

  const updateOption = (index: number, patch: Partial<CustomizeOptionDef>) => {
    const options = activeConfig.options.map((o, i) =>
      i === index ? { ...o, ...patch } : o,
    )
    setActiveConfig({ ...activeConfig, options })
  }

  const removeOption = (index: number) => {
    setActiveConfig({
      ...activeConfig,
      options: activeConfig.options.filter((_, i) => i !== index),
    })
  }

  const save = useCallback(async () => {
    setSaving(true)
    setMessage(null)
    try {
      const supabase = createBrowserSupabase()
      const { error } = await supabase
        .from("ai_settings")
        .update({
          setting_value: serializeOrderCustomizationsJson(state),
        })
        .eq("setting_key", ORDER_CUSTOMIZATIONS_KEY)

      if (error) throw error
      setMessage({ ok: true, text: "Guardado." })
      await ctx?.refresh()
    } catch (e) {
      setMessage({
        ok: false,
        text:
          e instanceof Error ? e.message : "No se pudo guardar. Revisa permisos.",
      })
    } finally {
      setSaving(false)
    }
  }, [state, ctx])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Personalización de platillos
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Define qué opciones ve el cliente al ordenar (Con todo, Sin salsa,
            etc.). Cada platillo puede usar la configuración global o la suya.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar cambios
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/staff/dashboard">Panel</Link>
          </Button>
        </div>
      </div>

      {message ? (
        <p
          className={
            message.ok ? "text-sm text-green-700" : "text-sm text-destructive"
          }
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Platillo</CardTitle>
            <CardDescription>Elige qué editar</CardDescription>
          </CardHeader>
          <CardContent className="p-0 max-h-[min(70vh,520px)] overflow-y-auto">
            <ul className="divide-y divide-border">
              {targets.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(t.key)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-muted/60 ${
                      selectedKey === t.key
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground"
                    }`}
                  >
                    {t.label}
                    {t.key !== "__global__" && (
                      <span className="block text-xs text-muted-foreground mt-0.5 font-normal">
                        {t.usesGlobal ? "Usa global" : "Personalizado"}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selected.label}</CardTitle>
            <CardDescription>
              {selected.key === "__global__"
                ? "Se aplica a todos los platillos sin configuración propia."
                : isEditingOverride
                  ? "Este platillo tiene opciones propias."
                  : "Ahora usa la configuración global."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selected.key !== "__global__" ? (
              <div className="flex flex-wrap gap-2">
                {!isEditingOverride ? (
                  <Button type="button" variant="secondary" onClick={enableOverride}>
                    Personalizar este platillo
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={useGlobalForPlatillo}
                    >
                      Volver a usar global
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setActiveConfig(
                          cloneConfig(defaultOrderCustomizationsJson().global),
                        )
                      }
                    >
                      Restaurar plantilla global
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            {(selected.key === "__global__" || isEditingOverride) && (
              <>
                <div className="max-w-md space-y-2">
                  <Label htmlFor="default-label">Texto del botón por defecto</Label>
                  <Input
                    id="default-label"
                    value={activeConfig.defaultLabel}
                    onChange={(e) =>
                      setActiveConfig({
                        ...activeConfig,
                        defaultLabel: e.target.value,
                      })
                    }
                    placeholder="Con todo"
                  />
                  <p className="text-xs text-muted-foreground">
                    ID interno: <code>{activeConfig.defaultId}</code> (fijo)
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Opciones al personalizar</Label>
                  <p className="text-xs text-muted-foreground">
                    El cliente las ve al tocar &quot;Personalizar&quot; al ordenar.
                  </p>
                  <ul className="space-y-2">
                    {activeConfig.options.map((opt, index) => (
                      <li
                        key={opt.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
                      >
                        <Input
                          value={opt.label}
                          onChange={(e) =>
                            updateOption(index, { label: e.target.value })
                          }
                          className="flex-1 min-w-[140px]"
                          placeholder="Etiqueta"
                        />
                        <code className="text-xs text-muted-foreground px-2">
                          {opt.id}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive shrink-0"
                          onClick={() => removeOption(index)}
                          aria-label="Eliminar opción"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {activeConfig.options.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin opciones extra: solo el botón por defecto.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Input
                      value={newOptionLabel}
                      onChange={(e) => setNewOptionLabel(e.target.value)}
                      placeholder="Nueva opción, ej. Sin crema"
                      className="max-w-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addOption()
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" onClick={addOption}>
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </div>
              </>
            )}

            {selected.key !== "__global__" && !isEditingOverride ? (
              <p className="text-sm text-muted-foreground">
                Vista previa de opciones globales:{" "}
                <strong>{state.global.defaultLabel}</strong>
                {state.global.options.length > 0
                  ? ` · ${state.global.options.map((o) => o.label).join(", ")}`
                  : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
