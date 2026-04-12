"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ImageIcon, Loader2, LogOut, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { HeroSlide } from "@/lib/home-hero-slides"
import { categorias, proteinas, type Proteina } from "@/lib/menu-data"
import {
  SITE_MEDIA_KEYS,
  defaultSiteMedia,
} from "@/lib/site-media-shared"
import { StorageUploadButton } from "@/components/storage-upload-button"
import { getBrowserSupabase, isCeoAccess } from "@/lib/supabase-browser"
import type { User } from "@supabase/supabase-js"

const MAX_SLIDES = 8

const PROTEINA_SLUG: Record<Proteina, string> = {
  Asada: "asada",
  Pollo: "pollo",
  Pastor: "pastor",
  Camarón: "camaron",
}

function parseSlidesFromDb(raw: string | undefined): HeroSlide[] {
  if (!raw?.trim()) return defaultSiteMedia().heroSlides
  try {
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j) || j.length === 0) return defaultSiteMedia().heroSlides
    const out: HeroSlide[] = []
    for (let i = 0; i < j.length; i++) {
      const row = j[i] as Record<string, unknown>
      if (
        row &&
        typeof row.src === "string" &&
        typeof row.alt === "string"
      ) {
        out.push({
          id: typeof row.id === "string" ? row.id : `slide-${i + 1}`,
          src: row.src,
          alt: row.alt,
        })
      }
    }
    return out.length ? out : defaultSiteMedia().heroSlides
  } catch {
    return defaultSiteMedia().heroSlides
  }
}

type SiteMediaEditorProps = {
  /** Server already checked public.users.role = ceo; avoids waiting on client profile. */
  serverVerifiedCeo?: boolean
}

export function SiteMediaEditor({
  serverVerifiedCeo = false,
}: SiteMediaEditorProps) {
  const router = useRouter()
  const [configError, setConfigError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{ role: string } | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)

  const [slides, setSlides] = useState<HeroSlide[]>(defaultSiteMedia().heroSlides)
  const [menuBanner, setMenuBanner] = useState(defaultSiteMedia().menuBannerUrl)
  const [catUrls, setCatUrls] = useState<Record<string, string>>(() => {
    const d = defaultSiteMedia().categoriaImagenes
    return { ...d }
  })
  const [proteinaUrls, setProteinaUrls] = useState<
    Record<Proteina, string>
  >(() => ({ ...defaultSiteMedia().proteinaImagenes }))

  const ceo = useMemo(() => {
    if (serverVerifiedCeo && user) return true
    return isCeoAccess(user, profile)
  }, [serverVerifiedCeo, user, profile])

  const loadProfile = useCallback(async (uid: string) => {
    const client = getBrowserSupabase()
    const { data } = await client
      .from("users")
      .select("role")
      .eq("id", uid)
      .maybeSingle()
    setProfile(data ?? null)
  }, [])

  const loadMedia = useCallback(async () => {
    if (!ceo) return
    setLoading(true)
    setSaveError(null)
    setSaveOk(false)
    const timeoutMs = 25_000
    let timedOut = false
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      setLoading(false)
      setSaveError("Tiempo de espera al cargar ajustes. Revisa la red o RLS en ai_settings.")
    }, timeoutMs)
    try {
      const client = getBrowserSupabase()
      const { data, error } = await client
        .from("ai_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          SITE_MEDIA_KEYS.heroSlides,
          SITE_MEDIA_KEYS.menuBanner,
          SITE_MEDIA_KEYS.categoriaImagenes,
          SITE_MEDIA_KEYS.proteinaImagenes,
        ])
      if (timedOut) return
      if (error) throw error
      const map = Object.fromEntries(
        (data ?? []).map((r) => [r.setting_key, r.setting_value]),
      ) as Record<string, string | undefined>

      const heroRaw = map[SITE_MEDIA_KEYS.heroSlides]
      setSlides(parseSlidesFromDb(heroRaw))

      const b = map[SITE_MEDIA_KEYS.menuBanner]?.trim()
      setMenuBanner(b && b.length > 0 ? b : defaultSiteMedia().menuBannerUrl)

      const catRaw = map[SITE_MEDIA_KEYS.categoriaImagenes]
      const base = defaultSiteMedia().categoriaImagenes
      if (catRaw?.trim()) {
        try {
          const parsed = JSON.parse(catRaw) as Record<string, string>
          const merged = { ...base }
          for (const c of categorias) {
            const v = parsed[c.id]
            if (typeof v === "string" && v.trim()) merged[c.id] = v.trim()
          }
          setCatUrls(merged)
        } catch {
          setCatUrls({ ...base })
        }
      } else {
        setCatUrls({ ...base })
      }

      const protRaw = map[SITE_MEDIA_KEYS.proteinaImagenes]
      const baseProt = defaultSiteMedia().proteinaImagenes
      if (protRaw?.trim()) {
        try {
          const parsed = JSON.parse(protRaw) as Record<string, string>
          const merged = { ...baseProt }
          for (const p of proteinas) {
            const v = parsed[p]
            if (typeof v === "string" && v.trim()) merged[p] = v.trim()
          }
          setProteinaUrls(merged)
        } catch {
          setProteinaUrls({ ...baseProt })
        }
      } else {
        setProteinaUrls({ ...baseProt })
      }
    } catch (e) {
      console.error(e)
      if (!timedOut) setSaveError("No se pudieron cargar las imágenes.")
    } finally {
      window.clearTimeout(timeoutId)
      if (!timedOut) setLoading(false)
    }
  }, [ceo])

  useEffect(() => {
    let cancelled = false
    try {
      const client = getBrowserSupabase()
      const sync = async () => {
        try {
          const {
            data: { session },
          } = await client.auth.getSession()
          if (cancelled) return
          const u = session?.user ?? null
          setUser(u)
          if (!u) setProfile(null)
          setSessionLoading(false)
          if (u) void loadProfile(u.id)
        } catch {
          setSessionLoading(false)
        }
      }
      void sync()
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_e, session) => {
        if (cancelled) return
        const u = session?.user ?? null
        setUser(u)
        if (u) void loadProfile(u.id)
        else setProfile(null)
      })
      return () => {
        cancelled = true
        subscription.unsubscribe()
      }
    } catch {
      setConfigError(
        "Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      )
      setSessionLoading(false)
    }
  }, [loadProfile])

  useEffect(() => {
    if (ceo) void loadMedia()
  }, [ceo, loadMedia])

  const handleLogout = async () => {
    try {
      const client = getBrowserSupabase()
      await client.auth.signOut()
      router.push("/staff/login?next=/edit")
      router.refresh()
    } catch {
      /* ignore */
    }
  }

  const handleSave = async () => {
    if (!ceo) return
    setSaving(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const client = getBrowserSupabase()
      const categoriaPayload: Record<string, string> = {}
      for (const c of categorias) {
        const u = catUrls[c.id]?.trim()
        if (u) categoriaPayload[c.id] = u
      }

      const proteinaPayload: Record<string, string> = {}
      for (const p of proteinas) {
        const u = proteinaUrls[p]?.trim()
        if (u) proteinaPayload[p] = u
      }

      const rows = [
        {
          setting_key: SITE_MEDIA_KEYS.heroSlides,
          setting_value: JSON.stringify(slides),
          description: "Homepage hero carousel JSON: [{id,src,alt}, ...]",
        },
        {
          setting_key: SITE_MEDIA_KEYS.menuBanner,
          setting_value: menuBanner.trim(),
          description: "Background image URL for /menu hero section",
        },
        {
          setting_key: SITE_MEDIA_KEYS.categoriaImagenes,
          setting_value: JSON.stringify(categoriaPayload),
          description:
            "JSON object: category id -> image URL (menu cards + category pages)",
        },
        {
          setting_key: SITE_MEDIA_KEYS.proteinaImagenes,
          setting_value: JSON.stringify(proteinaPayload),
          description:
            "JSON: Asada|Pollo|Pastor|Camarón -> image URL (selector de proteína)",
        },
      ]

      for (const row of rows) {
        const { error } = await client.from("ai_settings").upsert(row, {
          onConflict: "setting_key",
        })
        if (error) throw error
      }

      setSaveOk(true)
      router.refresh()
    } catch (e) {
      console.error(e)
      setSaveError("No se pudieron guardar los cambios.")
    } finally {
      setSaving(false)
    }
  }

  const updateSlide = (index: number, field: "src" | "alt", value: string) => {
    setSlides((prev) => {
      const next = [...prev]
      const row = next[index]
      if (!row) return prev
      next[index] = { ...row, [field]: value }
      return next
    })
    setSaveOk(false)
  }

  const addSlide = () => {
    setSlides((prev) => {
      if (prev.length >= MAX_SLIDES) return prev
      const n = prev.length + 1
      return [
        ...prev,
        {
          id: `slide-${n}`,
          src: "/placeholder.jpg",
          alt: `Imagen ${n}`,
        },
      ]
    })
    setSaveOk(false)
  }

  const removeSlide = (index: number) => {
    setSlides((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
    setSaveOk(false)
  }

  if (configError) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
          <CardDescription>{configError}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (sessionLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Sesión requerida</CardTitle>
          <CardDescription>
            Inicia sesión con una cuenta{" "}
            <code className="text-xs bg-muted px-1 rounded">ceo</code> en{" "}
            <code className="text-xs bg-muted px-1 rounded">public.users</code>.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/staff/login?next=/edit">Ir a iniciar sesión</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (!ceo) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Acceso denegado</CardTitle>
          <CardDescription>
            Solo el rol CEO puede editar imágenes del sitio.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/staff/dashboard">Panel personal</Link>
          </Button>
          <Button variant="outline" onClick={() => void handleLogout()}>
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Editar imágenes del sitio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Puedes pegar URLs o subir imágenes al bucket de Storage{" "}
            <code className="text-xs">files</code> (lectura pública; solo CEO
            sube). También rutas locales como{" "}
            <code className="text-xs">/foto.jpg</code> en{" "}
            <code className="text-xs">public/</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
          <LogOut className="h-4 w-4 mr-2" />
          Salir
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5" />
                Inicio — carrusel
              </CardTitle>
              <CardDescription>
                Imágenes del hero en la página principal (máx. {MAX_SLIDES}).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`slide-src-${index}`}>URL imagen {index + 1}</Label>
                    <Input
                      id={`slide-src-${index}`}
                      value={slide.src}
                      onChange={(e) => updateSlide(index, "src", e.target.value)}
                      placeholder="https://..."
                      autoComplete="off"
                    />
                    <StorageUploadButton
                      folderPath="site/hero"
                      onUploaded={(url) => updateSlide(index, "src", url)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`slide-alt-${index}`}>Texto alternativo</Label>
                    <Input
                      id={`slide-alt-${index}`}
                      value={slide.alt}
                      onChange={(e) => updateSlide(index, "alt", e.target.value)}
                      placeholder="Descripción breve"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0 sm:mt-8"
                    disabled={slides.length <= 1}
                    onClick={() => removeSlide(index)}
                    aria-label="Quitar imagen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addSlide}
                disabled={slides.length >= MAX_SLIDES}
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir imagen
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Menú — banner superior</CardTitle>
              <CardDescription>
                Imagen de fondo del encabezado en{" "}
                <code className="text-xs">/menu</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="menu-banner">URL</Label>
                <Input
                  id="menu-banner"
                  value={menuBanner}
                  onChange={(e) => {
                    setMenuBanner(e.target.value)
                    setSaveOk(false)
                  }}
                  placeholder="https://..."
                />
                <StorageUploadButton
                  folderPath="site/menu-banner"
                  onUploaded={(url) => {
                    setMenuBanner(url)
                    setSaveOk(false)
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Menú — miniaturas por categoría</CardTitle>
              <CardDescription>
                Usadas en tarjetas de <code className="text-xs">/menu</code>,{" "}
                <code className="text-xs">/menu/[categoría]</code> y vista previa del
                inicio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categorias.map((c) => (
                <div key={c.id} className="space-y-2">
                  <Label htmlFor={`cat-${c.id}`}>{c.nombre}</Label>
                  <Input
                    id={`cat-${c.id}`}
                    value={catUrls[c.id] ?? ""}
                    onChange={(e) => {
                      setCatUrls((prev) => ({
                        ...prev,
                        [c.id]: e.target.value,
                      }))
                      setSaveOk(false)
                    }}
                    placeholder="https://..."
                  />
                  <StorageUploadButton
                    folderPath={`site/categoria/${c.id}`}
                    onUploaded={(url) => {
                      setCatUrls((prev) => ({ ...prev, [c.id]: url }))
                      setSaveOk(false)
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proteínas</CardTitle>
              <CardDescription>
                Miniatura por cada opción (menú, ordenar en mesa/llevar, panel staff).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {proteinas.map((p) => (
                <div key={p} className="space-y-2">
                  <Label htmlFor={`prot-${p}`}>{p}</Label>
                  <Input
                    id={`prot-${p}`}
                    value={proteinaUrls[p] ?? ""}
                    onChange={(e) => {
                      setProteinaUrls((prev) => ({
                        ...prev,
                        [p]: e.target.value,
                      }))
                      setSaveOk(false)
                    }}
                    placeholder="https://..."
                  />
                  <StorageUploadButton
                    folderPath={`site/proteina/${PROTEINA_SLUG[p]}`}
                    onUploaded={(url) => {
                      setProteinaUrls((prev) => ({ ...prev, [p]: url }))
                      setSaveOk(false)
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {saveError && (
            <p className="text-sm text-destructive text-center" role="alert">
              {saveError}
            </p>
          )}
          {saveOk && (
            <p className="text-sm text-green-600 dark:text-green-400 text-center">
              Cambios guardados. Puede tardar unos segundos en verse en el sitio.
            </p>
          )}

          <div className="flex justify-center">
            <Button
              type="button"
              size="lg"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
