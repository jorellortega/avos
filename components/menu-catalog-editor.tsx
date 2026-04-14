"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Loader2, Save } from "lucide-react"
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
  BEBIDAS_CATEGORIA_ID,
  bebidas,
  categorias,
  proteinas,
} from "@/lib/menu-data"
import {
  MENU_CATALOG_KEY,
  type MenuCatalogJson,
  serializeMenuCatalogJson,
} from "@/lib/menu-catalog-shared"
import { useMenuCatalogContextOptional } from "@/components/menu-catalog-provider"

function cloneJson(j: MenuCatalogJson): MenuCatalogJson {
  return {
    categoriaPrecios: { ...j.categoriaPrecios },
    bebidaPrecios: { ...j.bebidaPrecios },
    camarónExtra: j.camarónExtra,
    outCategorias: [...j.outCategorias],
    outProteinas: [...j.outProteinas],
    outBebidas: [...j.outBebidas],
  }
}

type Props = {
  initial: MenuCatalogJson
}

export function MenuCatalogEditor({ initial }: Props) {
  const ctx = useMenuCatalogContextOptional()
  const [state, setState] = useState(() => cloneJson(initial))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )

  const setCategoriaPrecio = (id: string, val: string) => {
    const n = parseFloat(val)
    setState((s) => {
      const next = cloneJson(s)
      if (val === "" || !Number.isFinite(n)) {
        delete next.categoriaPrecios[id]
      } else {
        next.categoriaPrecios[id] = n
      }
      return next
    })
  }

  const setBebidaPrecio = (id: string, val: string) => {
    const n = parseFloat(val)
    setState((s) => {
      const next = cloneJson(s)
      if (val === "" || !Number.isFinite(n)) {
        delete next.bebidaPrecios[id]
      } else {
        next.bebidaPrecios[id] = n
      }
      return next
    })
  }

  const toggleList = (
    key: "outCategorias" | "outProteinas" | "outBebidas",
    id: string,
    checked: boolean,
  ) => {
    setState((s) => {
      const next = cloneJson(s)
      const set = new Set(next[key])
      if (checked) set.add(id)
      else set.delete(id)
      next[key] = Array.from(set)
      return next
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
          setting_value: serializeMenuCatalogJson(state),
        })
        .eq("setting_key", MENU_CATALOG_KEY)

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

  const categoriaPrecioInput = (id: string) => {
    const v = state.categoriaPrecios[id]
    const def = categorias.find((c) => c.id === id)?.precioBase
    return v !== undefined ? String(v) : def !== undefined ? String(def) : ""
  }

  const bebidaPrecioInput = (id: string) => {
    const v = state.bebidaPrecios[id]
    const def = bebidas.find((b) => b.id === id)?.precio
    return v !== undefined ? String(v) : def !== undefined ? String(def) : ""
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Precios y disponibilidad
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Los clientes no podrán ordenar lo que marques como agotado. Los
            precios vacíos usan el valor del menú base.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar
        </Button>
      </div>

      {message && (
        <p
          className={`text-sm ${message.ok ? "text-green-600" : "text-destructive"}`}
          role="status"
        >
          {message.text}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Platillos por categoría</CardTitle>
          <CardDescription>
            Precio base (antes de extra por Camarón) y categoría agotada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {categorias.map((c) => (
            <div
              key={c.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium">{c.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  Base en código: ${c.precioBase}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="space-y-1">
                  <Label htmlFor={`precio-${c.id}`} className="text-xs">
                    Precio (MXN)
                  </Label>
                  <Input
                    id={`precio-${c.id}`}
                    type="number"
                    min={0}
                    step={1}
                    className="w-28"
                    placeholder={String(c.precioBase)}
                    value={categoriaPrecioInput(c.id)}
                    onChange={(e) => setCategoriaPrecio(c.id, e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={state.outCategorias.includes(c.id)}
                    onCheckedChange={(ch) =>
                      toggleList("outCategorias", c.id, ch === true)
                    }
                  />
                  Agotado
                </label>
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-border">
            <Label htmlFor="camaron-extra">Extra Camarón (MXN)</Label>
            <Input
              id="camaron-extra"
              type="number"
              min={0}
              step={1}
              className="w-32 mt-1"
              placeholder="20"
              value={
                state.camarónExtra === null ? "" : String(state.camarónExtra)
              }
              onChange={(e) => {
                const v = e.target.value
                setState((s) => {
                  const next = cloneJson(s)
                  if (v === "") next.camarónExtra = null
                  else {
                    const n = parseFloat(v)
                    next.camarónExtra = Number.isFinite(n) ? n : null
                  }
                  return next
                })
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Vacío = usar $20 por defecto.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proteínas</CardTitle>
          <CardDescription>
            Si una proteína está agotada, no podrán elegirla en el menú ni en
            ordenar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {proteinas.map((p) => (
            <label
              key={p}
              className="flex items-center gap-2 text-sm cursor-pointer border rounded-lg px-3 py-2"
            >
              <Checkbox
                checked={state.outProteinas.includes(p)}
                onCheckedChange={(ch) =>
                  toggleList("outProteinas", p, ch === true)
                }
              />
              {p} agotada
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bebidas (aguas)</CardTitle>
          <CardDescription>
            Sección &quot;bebidas&quot; en el menú. Puedes agotar toda la
            categoría desde platillos arriba o solo sabores aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer border rounded-lg px-3 py-2 w-fit">
            <Checkbox
              checked={state.outCategorias.includes(BEBIDAS_CATEGORIA_ID)}
              onCheckedChange={(ch) =>
                toggleList("outCategorias", BEBIDAS_CATEGORIA_ID, ch === true)
              }
            />
            Toda la categoría Bebidas agotada
          </label>
          {bebidas.map((b) => (
            <div
              key={b.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-border pb-4 last:border-0"
            >
              <div className="flex-1 font-medium">{b.nombre}</div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor={`beb-${b.id}`}>
                    Precio
                  </Label>
                  <Input
                    id={`beb-${b.id}`}
                    type="number"
                    min={0}
                    step={1}
                    className="w-28"
                    placeholder={String(b.precio)}
                    value={bebidaPrecioInput(b.id)}
                    onChange={(e) => setBebidaPrecio(b.id, e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={state.outBebidas.includes(b.id)}
                    onCheckedChange={(ch) =>
                      toggleList("outBebidas", b.id, ch === true)
                    }
                  />
                  Agotado
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/staff/dashboard" className="underline underline-offset-2">
          Volver al panel
        </Link>
        {" · "}
        <Link href="/staff/ordenes" className="underline underline-offset-2">
          Órdenes y pagos
        </Link>
      </p>
    </div>
  )
}
