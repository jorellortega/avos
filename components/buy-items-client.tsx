"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Camera,
  ClipboardCopy,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  InventoryCameraDialog,
  fileToBase64,
  prepareImageFile,
} from "@/components/inventory-ai-scan-button"
import {
  type BuyListItem,
  createBuyListItemId,
  linesToBuyItems,
  stringsToBuyListItems,
} from "@/lib/buy-list-ai"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "avos-buy-items-list-v1"

function loadStoredItems(): BuyListItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BuyListItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i) => i && typeof i.id === "string" && typeof i.text === "string",
    )
  } catch {
    return []
  }
}

export function BuyItemsClient() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<BuyListItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [manualText, setManualText] = useState("")
  const [scanning, setScanning] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanNote, setScanNote] = useState<string | null>(null)

  useEffect(() => {
    setItems(loadStoredItems())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, hydrated])

  const setList = useCallback((next: BuyListItem[], note?: string | null) => {
    setItems(next)
    setScanNote(note ?? null)
    setError(null)
  }, [])

  const appendLines = useCallback((lines: string[]) => {
    if (lines.length === 0) return
    setItems((prev) => [...prev, ...stringsToBuyListItems(lines)])
    setError(null)
  }, [])

  const replaceWithLines = useCallback((lines: string[], note?: string) => {
    setList(stringsToBuyListItems(lines), note)
  }, [setList])

  const mergeScanResult = useCallback(
    (lines: string[], note?: string, replace = false) => {
      if (replace) {
        replaceWithLines(lines, note)
        return
      }
      if (items.length === 0) {
        replaceWithLines(lines, note)
        return
      }
      const add = window.confirm(
        `¿Agregar ${lines.length} artículo(s) a la lista actual (${items.length})? Cancelar = reemplazar lista.`,
      )
      if (add) {
        appendLines(lines)
        if (note) setScanNote(note)
      } else {
        replaceWithLines(lines, note)
      }
    },
    [items.length, appendLines, replaceWithLines],
  )

  const scanImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Elige una imagen.")
      return
    }
    setScanning(true)
    setError(null)
    try {
      const prepared = await prepareImageFile(file)
      if (prepared.size > 8 * 1024 * 1024) {
        setError("Máximo 8 MB. Usa otra foto.")
        return
      }
      const imageBase64 = await fileToBase64(prepared)
      const res = await fetch("/api/buy-items-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "image",
          imageBase64,
          mimeType: prepared.type || "image/jpeg",
        }),
      })
      const data = (await res.json()) as {
        error?: string
        scan?: { items: string[]; notes?: string }
      }
      if (!res.ok) {
        setError(data.error ?? "No se pudo leer la foto.")
        if (data.scan?.items?.length) {
          mergeScanResult(data.scan.items, data.scan.notes, false)
        }
        return
      }
      if (!data.scan?.items?.length) {
        setError("No se detectaron artículos en la foto.")
        return
      }
      mergeScanResult(data.scan.items, data.scan.notes, items.length === 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red.")
    } finally {
      setScanning(false)
    }
  }, [items.length, mergeScanResult])

  const organizeText = useCallback(async () => {
    const text = manualText.trim()
    if (!text) {
      setError("Escribe o pega una lista primero.")
      return
    }
    setOrganizing(true)
    setError(null)
    try {
      const res = await fetch("/api/buy-items-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "text", text }),
      })
      const data = (await res.json()) as {
        error?: string
        scan?: { items: string[]; notes?: string }
      }
      if (!res.ok) {
        setError(data.error ?? "No se pudo organizar la lista.")
        return
      }
      if (!data.scan?.items?.length) {
        setError("La IA no encontró artículos en el texto.")
        return
      }
      mergeScanResult(data.scan.items, data.scan.notes, items.length === 0)
      setManualText("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red.")
    } finally {
      setOrganizing(false)
    }
  }, [manualText, items.length, mergeScanResult])

  const addManualLines = useCallback(() => {
    const lines = linesToBuyItems(manualText)
    if (lines.length === 0) {
      setError("Escribe un artículo por línea.")
      return
    }
    appendLines(lines)
    setManualText("")
  }, [manualText, appendLines])

  const updateItem = (id: string, patch: Partial<BuyListItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    )
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const addBlankItem = () => {
    setItems((prev) => [
      ...prev,
      { id: createBuyListItemId(), text: "", done: false },
    ])
  }

  const copyList = async () => {
    const text = items
      .map((item, i) => `${i + 1}. ${item.text}${item.done ? " ✓" : ""}`)
      .join("\n")
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setError("No se pudo copiar al portapapeles.")
    }
  }

  const pending = items.filter((i) => !i.done).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Lista de compras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escanea una foto con IA o escribe la lista. Edita cada línea antes de ir
            a comprar.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/staff/dashboard">Panel</Link>
        </Button>
      </div>

      <Tabs defaultValue="photo" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="photo">Foto / IA</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="photo" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Escanear lista</CardTitle>
              <CardDescription>
                Foto de lista escrita, recibo, nota o pantalla. La IA arma la lista
                numerada abajo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) void scanImage(f)
                }}
              />
              <Button
                type="button"
                disabled={scanning}
                onClick={() => fileRef.current?.click()}
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4 mr-2" />
                )}
                {scanning ? "Leyendo foto…" : "Subir foto"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={scanning}
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="h-4 w-4 mr-2" />
                Cámara
              </Button>
              <InventoryCameraDialog
                open={cameraOpen}
                onOpenChange={setCameraOpen}
                onCapture={(file) => void scanImage(file)}
                onError={setError}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lista manual</CardTitle>
              <CardDescription>
                Un artículo por línea. «Agregar líneas» sin IA, o «Organizar con IA»
                para limpiar texto desordenado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="manual-list">Artículos</Label>
                <Textarea
                  id="manual-list"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder={"2 kg tomates\nleche entera\ncilantro\npan bolillo"}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={addManualLines}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar líneas
                </Button>
                <Button
                  type="button"
                  disabled={organizing || !manualText.trim()}
                  onClick={() => void organizeText()}
                >
                  {organizing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Organizar con IA
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {scanNote && (
        <p className="text-xs text-amber-700 dark:text-amber-400">⚠ {scanNote}</p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Tu lista
                {items.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-2">
                    {pending} pendiente{pending === 1 ? "" : "s"} · {items.length}{" "}
                    total
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Toca el texto para corregir. Marca ✓ al comprar.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={items.length === 0}
                onClick={() => void copyList()}
              >
                <ClipboardCopy className="h-3.5 w-3.5 mr-1" />
                Copiar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addBlankItem}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Línea
              </Button>
              {items.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    if (window.confirm("¿Borrar toda la lista?")) setList([])
                  }}
                >
                  Vaciar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin artículos. Sube una foto o escribe la lista arriba.
            </p>
          ) : (
            <ol className="space-y-2">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                    item.done && "opacity-60 bg-muted/40",
                  )}
                >
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={(checked) =>
                      updateItem(item.id, { done: checked === true })
                    }
                    aria-label={`Comprado: ${item.text || "artículo"}`}
                  />
                  <span
                    className="text-sm font-semibold tabular-nums text-muted-foreground w-6 shrink-0 text-right"
                    aria-hidden
                  >
                    {index + 1}.
                  </span>
                  <Input
                    value={item.text}
                    onChange={(e) => updateItem(item.id, { text: e.target.value })}
                    className="border-0 shadow-none focus-visible:ring-1 h-9 flex-1"
                    placeholder="Nombre del artículo"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Eliminar"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
