"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BebidaThumb } from "@/components/bebida-thumb"
import { Checkbox } from "@/components/ui/checkbox"
import { useBebidaImagenes } from "@/lib/use-bebida-imagenes"
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
  bebidaTamanoLabels,
  categorias,
  getPlatillosForCategoria,
  proteinas,
  type BebidaTamano,
  type Proteina,
} from "@/lib/menu-data"
import {
  MENU_CATALOG_KEY,
  catalogPlatilloKey,
  type MenuCatalogJson,
  serializeMenuCatalogJson,
} from "@/lib/menu-catalog-shared"
import { useMenuCatalogContextOptional } from "@/components/menu-catalog-provider"

function cloneJson(j: MenuCatalogJson): MenuCatalogJson {
  const proteinaPreciosPorCategoria: MenuCatalogJson["proteinaPreciosPorCategoria"] =
    {}
  for (const [catId, map] of Object.entries(j.proteinaPreciosPorCategoria)) {
    if (map) proteinaPreciosPorCategoria[catId] = { ...map }
  }
  const hiddenProteinasPorCategoria: MenuCatalogJson["hiddenProteinasPorCategoria"] =
    {}
  for (const [catId, list] of Object.entries(j.hiddenProteinasPorCategoria)) {
    if (list?.length) hiddenProteinasPorCategoria[catId] = [...list]
  }
  const outProteinasPorCategoria: MenuCatalogJson["outProteinasPorCategoria"] =
    {}
  for (const [catId, list] of Object.entries(j.outProteinasPorCategoria)) {
    if (list?.length) outProteinasPorCategoria[catId] = [...list]
  }
  const bebidaPrecios: MenuCatalogJson["bebidaPrecios"] = {}
  for (const [bebidaId, sizes] of Object.entries(j.bebidaPrecios)) {
    if (sizes) bebidaPrecios[bebidaId] = { ...sizes }
  }
  return {
    categoriaPrecios: { ...j.categoriaPrecios },
    proteinaPreciosPorCategoria,
    bebidaPrecios,
    camarónExtra: j.camarónExtra,
    outCategorias: [...j.outCategorias],
    outProteinas: [...j.outProteinas],
    outProteinasPorCategoria,
    outBebidas: [...j.outBebidas],
    hiddenCategorias: [...j.hiddenCategorias],
    hiddenProteinas: [...j.hiddenProteinas],
    hiddenProteinasPorCategoria,
    hiddenBebidas: [...j.hiddenBebidas],
    outPlatillos: [...j.outPlatillos],
    hiddenPlatillos: [...j.hiddenPlatillos],
  }
}

type Props = {
  initial: MenuCatalogJson
}

export function MenuCatalogEditor({ initial }: Props) {
  const ctx = useMenuCatalogContextOptional()
  const bebidaImgs = useBebidaImagenes()
  const [state, setState] = useState(() => cloneJson(initial))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )

  const isProteinaHiddenForKey = (catalogKey: string, proteina: Proteina) =>
    state.hiddenProteinas.includes(proteina) ||
    (state.hiddenProteinasPorCategoria[catalogKey]?.includes(proteina) ?? false)

  const toggleProteinaHiddenForKey = (
    catalogKey: string,
    proteina: Proteina,
    checked: boolean,
  ) => {
    setState((s) => {
      const next = cloneJson(s)
      const list = new Set(next.hiddenProteinasPorCategoria[catalogKey] ?? [])
      if (checked) list.add(proteina)
      else list.delete(proteina)
      if (list.size === 0) {
        delete next.hiddenProteinasPorCategoria[catalogKey]
      } else {
        next.hiddenProteinasPorCategoria[catalogKey] = Array.from(
          list,
        ) as Proteina[]
      }
      return next
    })
  }

  const isProteinaOutForKey = (catalogKey: string, proteina: Proteina) =>
    state.outProteinas.includes(proteina) ||
    (state.outProteinasPorCategoria[catalogKey]?.includes(proteina) ?? false)

  const toggleProteinaOutForKey = (
    catalogKey: string,
    proteina: Proteina,
    checked: boolean,
  ) => {
    setState((s) => {
      const next = cloneJson(s)
      const list = new Set(next.outProteinasPorCategoria[catalogKey] ?? [])
      if (checked) list.add(proteina)
      else list.delete(proteina)
      if (list.size === 0) {
        delete next.outProteinasPorCategoria[catalogKey]
      } else {
        next.outProteinasPorCategoria[catalogKey] = Array.from(list) as Proteina[]
      }
      return next
    })
  }

  const setProteinaPrecio = (
    catalogKey: string,
    proteina: Proteina,
    val: string,
  ) => {
    const n = parseFloat(val)
    setState((s) => {
      const next = cloneJson(s)
      const cat = { ...(next.proteinaPreciosPorCategoria[catalogKey] ?? {}) }
      if (val === "" || !Number.isFinite(n)) {
        delete cat[proteina]
      } else {
        cat[proteina] = n
      }
      if (Object.keys(cat).length === 0) {
        delete next.proteinaPreciosPorCategoria[catalogKey]
      } else {
        next.proteinaPreciosPorCategoria[catalogKey] = cat
      }
      return next
    })
  }

  const setBebidaPrecio = (
    id: string,
    tamano: BebidaTamano,
    val: string,
  ) => {
    const n = parseFloat(val)
    setState((s) => {
      const next = cloneJson(s)
      const sizes = { ...(next.bebidaPrecios[id] ?? {}) }
      if (val === "" || !Number.isFinite(n)) {
        delete sizes[tamano]
      } else {
        sizes[tamano] = n
      }
      if (Object.keys(sizes).length === 0) {
        delete next.bebidaPrecios[id]
      } else {
        next.bebidaPrecios[id] = sizes
      }
      return next
    })
  }

  const toggleList = (
    key:
      | "outCategorias"
      | "outProteinas"
      | "outBebidas"
      | "outPlatillos"
      | "hiddenCategorias"
      | "hiddenProteinas"
      | "hiddenBebidas"
      | "hiddenPlatillos",
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

  const bebidaPrecioInput = (id: string, tamano: BebidaTamano) => {
    const v = state.bebidaPrecios[id]?.[tamano]
    return v !== undefined ? String(v) : ""
  }

  const bebidaPrecioPlaceholder = (id: string, tamano: BebidaTamano) => {
    const b = bebidas.find((beb) => beb.id === id)
    if (!b) return ""
    return String(tamano === "chico" ? b.precioChico : b.precioGrande)
  }

  const categoriaBase = (id: string) =>
    categorias.find((c) => c.id === id)?.precioBase ?? 0

  const camarónExtraEffective = () => {
    const e = state.camarónExtra
    return typeof e === "number" && Number.isFinite(e) ? e : 20
  }

  const proteinaPrecioInput = (catalogKey: string, proteina: Proteina) => {
    const v = state.proteinaPreciosPorCategoria[catalogKey]?.[proteina]
    return v !== undefined ? String(v) : ""
  }

  const platilloBasePrice = (categoriaId: string, platilloId: string) => {
    const cat = categorias.find((x) => x.id === categoriaId)
    if (!cat) return 0
    const p = getPlatillosForCategoria(cat).find((x) => x.id === platilloId)
    return p?.precioBase ?? cat.precioBase
  }

  const proteinaPrecioPlaceholder = (
    categoriaId: string,
    platilloId: string,
    proteina: Proteina,
  ) => {
    const base = platilloBasePrice(categoriaId, platilloId)
    if (proteina === "Camarón") return String(base + camarónExtraEffective())
    return String(base)
  }

  const platilloPrecioInput = (catalogKey: string) => {
    const v = state.categoriaPrecios[catalogKey]
    return v !== undefined ? String(v) : ""
  }

  const setPlatilloPrecio = (catalogKey: string, val: string) => {
    const n = parseFloat(val)
    setState((s) => {
      const next = cloneJson(s)
      if (val === "" || !Number.isFinite(n)) {
        delete next.categoriaPrecios[catalogKey]
      } else {
        next.categoriaPrecios[catalogKey] = n
      }
      return next
    })
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto w-full px-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Precios y disponibilidad
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            <strong>Agotado</strong>: se ve pero no se puede ordenar.{" "}
            <strong>Oculto</strong>: no aparece para clientes. Los precios
            vacíos usan el menú base.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/customizations-edit">Personalización de pedidos</Link>
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar
          </Button>
        </div>
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
            Precio por proteína. Camarón suma el extra si no tiene precio
            propio. &quot;Agotado&quot; y &quot;Oculto&quot; por proteína
            aplican solo a ese platillo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {categorias.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-border p-4 md:p-5"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[11rem_minmax(0,1fr)] gap-6 items-start">
              <div className="space-y-3">
                <p className="font-medium text-base">{c.nombre}</p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={state.outCategorias.includes(c.id)}
                      onCheckedChange={(ch) =>
                        toggleList("outCategorias", c.id, ch === true)
                      }
                    />
                    Agotado
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={state.hiddenCategorias.includes(c.id)}
                      onCheckedChange={(ch) =>
                        toggleList("hiddenCategorias", c.id, ch === true)
                      }
                    />
                    Oculto del menú
                  </label>
                </div>
              </div>

              {c.tieneProteinas ? (
                <div className="space-y-6 w-full">
                  {getPlatillosForCategoria(c).map((platillo) => {
                    const catalogKey = catalogPlatilloKey(c.id, platillo.id)
                    return (
                      <div
                        key={platillo.id}
                        className="space-y-3 border-t border-border/60 pt-4 first:border-0 first:pt-0"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <p className="font-medium text-sm">{platillo.nombre}</p>
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={state.outPlatillos.includes(catalogKey)}
                                onCheckedChange={(ch) =>
                                  toggleList("outPlatillos", catalogKey, ch === true)
                                }
                              />
                              Agotado
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={state.hiddenPlatillos.includes(catalogKey)}
                                onCheckedChange={(ch) =>
                                  toggleList("hiddenPlatillos", catalogKey, ch === true)
                                }
                              />
                              Oculto del menú
                            </label>
                          </div>
                        </div>
                        {platillo.tieneProteinas === false ? (
                          <div className="space-y-2 max-w-xs">
                            <Label htmlFor={`plat-precio-${catalogKey}`}>
                              Precio (MXN)
                            </Label>
                            <Input
                              id={`plat-precio-${catalogKey}`}
                              type="number"
                              min={0}
                              step={1}
                              placeholder={String(platillo.precioBase)}
                              value={platilloPrecioInput(catalogKey)}
                              onChange={(e) =>
                                setPlatilloPrecio(catalogKey, e.target.value)
                              }
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-muted-foreground">
                              Precio por proteína (MXN)
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                              {proteinas.map((p) => (
                                <div
                                  key={p}
                                  className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2 min-w-0"
                                >
                                  <Label htmlFor={`precio-${catalogKey}-${p}`} className="text-xs">
                                    {p}
                                  </Label>
                                  <Input
                                    id={`precio-${catalogKey}-${p}`}
                                    type="number"
                                    min={0}
                                    step={1}
                                    className="w-full"
                                    placeholder={proteinaPrecioPlaceholder(c.id, platillo.id, p)}
                                    value={proteinaPrecioInput(catalogKey, p)}
                                    onChange={(e) =>
                                      setProteinaPrecio(catalogKey, p, e.target.value)
                                    }
                                  />
                                  <div className="flex flex-col gap-1.5">
                                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                      <Checkbox
                                        checked={isProteinaOutForKey(catalogKey, p)}
                                        disabled={state.outProteinas.includes(p)}
                                        onCheckedChange={(ch) =>
                                          toggleProteinaOutForKey(catalogKey, p, ch === true)
                                        }
                                      />
                                      Agotado
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                      <Checkbox
                                        checked={isProteinaHiddenForKey(catalogKey, p)}
                                        disabled={state.hiddenProteinas.includes(p)}
                                        onCheckedChange={(ch) =>
                                          toggleProteinaHiddenForKey(catalogKey, p, ch === true)
                                        }
                                      />
                                      Oculto
                                    </label>
                                  </div>
                                  {(state.outProteinas.includes(p) ||
                                    state.hiddenProteinas.includes(p)) && (
                                    <p className="text-[10px] text-muted-foreground leading-tight space-y-0.5">
                                      <span className="block">
                                        {state.outProteinas.includes(p) &&
                                        state.hiddenProteinas.includes(p)
                                          ? "Agotada y oculta en todos los platillos."
                                          : state.outProteinas.includes(p)
                                            ? "Agotada en todos los platillos."
                                            : "Oculta en todos los platillos."}
                                      </span>
                                      <span className="block">
                                        {state.outProteinas.includes(p) && (
                                          <button
                                            type="button"
                                            className="text-primary underline underline-offset-2 hover:no-underline"
                                            onClick={() => toggleList("outProteinas", p, false)}
                                          >
                                            Quitar agotado global
                                          </button>
                                        )}
                                        {state.outProteinas.includes(p) &&
                                          state.hiddenProteinas.includes(p) &&
                                          " · "}
                                        {state.hiddenProteinas.includes(p) && (
                                          <button
                                            type="button"
                                            className="text-primary underline underline-offset-2 hover:no-underline"
                                            onClick={() => toggleList("hiddenProteinas", p, false)}
                                          >
                                            Quitar oculto global
                                          </button>
                                        )}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : null}
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
            Agotada u oculta aquí: en todos los platillos. Para solo un
            platillo, usa las casillas junto al precio arriba.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {proteinas.map((p) => (
            <div
              key={p}
              className="flex flex-col gap-2 border rounded-lg px-3 py-2 text-sm"
            >
              <span className="font-medium">{p}</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={state.outProteinas.includes(p)}
                  onCheckedChange={(ch) =>
                    toggleList("outProteinas", p, ch === true)
                  }
                />
                Agotada
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={state.hiddenProteinas.includes(p)}
                  onCheckedChange={(ch) =>
                    toggleList("hiddenProteinas", p, ch === true)
                  }
                />
                Oculta del menú
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bebidas (aguas)</CardTitle>
          <CardDescription>
            Precio chico y grande por sabor. Puedes agotar u ocultar toda la
            categoría desde platillos arriba o solo sabores aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer border rounded-lg px-3 py-2">
              <Checkbox
                checked={state.outCategorias.includes(BEBIDAS_CATEGORIA_ID)}
                onCheckedChange={(ch) =>
                  toggleList("outCategorias", BEBIDAS_CATEGORIA_ID, ch === true)
                }
              />
              Toda la categoría Bebidas agotada
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer border rounded-lg px-3 py-2">
              <Checkbox
                checked={state.hiddenCategorias.includes(BEBIDAS_CATEGORIA_ID)}
                onCheckedChange={(ch) =>
                  toggleList(
                    "hiddenCategorias",
                    BEBIDAS_CATEGORIA_ID,
                    ch === true,
                  )
                }
              />
              Toda la categoría Bebidas oculta
            </label>
          </div>
          {bebidas.map((b) => (
            <div
              key={b.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-border pb-4 last:border-0"
            >
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <BebidaThumb
                  src={bebidaImgs[b.id]}
                  alt={b.nombre}
                  className="h-10 w-10"
                />
                <span className="font-medium">{b.nombre}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {(["chico", "grande"] as const).map((tam) => (
                  <div key={tam} className="space-y-1">
                    <Label className="text-xs" htmlFor={`beb-${b.id}-${tam}`}>
                      {bebidaTamanoLabels[tam]} (MXN)
                    </Label>
                    <Input
                      id={`beb-${b.id}-${tam}`}
                      type="number"
                      min={0}
                      step={1}
                      className="w-24"
                      placeholder={bebidaPrecioPlaceholder(b.id, tam)}
                      value={bebidaPrecioInput(b.id, tam)}
                      onChange={(e) =>
                        setBebidaPrecio(b.id, tam, e.target.value)
                      }
                    />
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={state.outBebidas.includes(b.id)}
                    onCheckedChange={(ch) =>
                      toggleList("outBebidas", b.id, ch === true)
                    }
                  />
                  Agotado
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={state.hiddenBebidas.includes(b.id)}
                    onCheckedChange={(ch) =>
                      toggleList("hiddenBebidas", b.id, ch === true)
                    }
                  />
                  Oculto del menú
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
