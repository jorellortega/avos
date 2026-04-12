"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, LogOut, RefreshCw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AISetting } from "@/lib/ai-types"
import { getBrowserSupabase, isCeoAccess } from "@/lib/supabase-browser"
import type { User } from "@supabase/supabase-js"

const OPENAI_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
] as const

const ANTHROPIC_MODELS = [
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
] as const

function labelForKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function isSecretSetting(key: string): boolean {
  return key.includes("api_key") || key.includes("secret")
}

export function AiSettingsPanel() {
  const router = useRouter()
  const [configError, setConfigError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{ role: string } | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [rows, setRows] = useState<AISetting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>(
    {},
  )

  const ceo = useMemo(() => isCeoAccess(user, profile), [user, profile])

  const loadProfile = useCallback(async (uid: string) => {
    const client = getBrowserSupabase()
    const { data } = await client
      .from("users")
      .select("role")
      .eq("id", uid)
      .maybeSingle()
    setProfile(data ?? null)
  }, [])

  const loadSettings = useCallback(async () => {
    if (!ceo) return
    setSettingsLoading(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const client = getBrowserSupabase()
      const { data, error } = await client
        .from("ai_settings")
        .select("setting_key, setting_value, description, updated_at")
        .order("setting_key")

      if (error) throw error
      const list = (data ?? []) as AISetting[]
      setRows(list)
      const next: Record<string, string> = {}
      for (const r of list) {
        next[r.setting_key] = r.setting_value ?? ""
      }
      setValues(next)
    } catch (e) {
      console.error(e)
      setSaveError("No se pudieron cargar los ajustes. ¿Rol CEO en public.users?")
    } finally {
      setSettingsLoading(false)
    }
  }, [ceo])

  useEffect(() => {
    let cancelled = false
    try {
      const client = getBrowserSupabase()

      const sync = async () => {
        const {
          data: { session },
        } = await client.auth.getSession()
        if (cancelled) return
        const u = session?.user ?? null
        setUser(u)
        if (u) await loadProfile(u.id)
        else setProfile(null)
        setSessionLoading(false)
      }

      void sync()

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange(async (_event, session) => {
        if (cancelled) return
        const u = session?.user ?? null
        setUser(u)
        if (u) await loadProfile(u.id)
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
    if (ceo) void loadSettings()
  }, [ceo, loadSettings])

  const handleLogout = async () => {
    try {
      const client = getBrowserSupabase()
      await client.auth.signOut()
      router.push("/staff/login?next=/ai-settings")
      router.refresh()
    } catch {
      /* ignore */
    }
    setRows([])
    setValues({})
  }

  const updateValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaveOk(false)
  }

  const handleSave = async () => {
    if (!ceo) return
    setSaving(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const client = getBrowserSupabase()
      for (const row of rows) {
        const next = values[row.setting_key] ?? ""
        if (next === row.setting_value) continue
        const { error } = await client
          .from("ai_settings")
          .update({ setting_value: next })
          .eq("setting_key", row.setting_key)
        if (error) throw error
      }
      await loadSettings()
      setSaveOk(true)
    } catch (e) {
      console.error(e)
      setSaveError("No se pudieron guardar los cambios.")
    } finally {
      setSaving(false)
    }
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
            Inicia sesión con una cuenta que tenga{" "}
            <code className="text-xs bg-muted px-1 rounded">role = ceo</code> en
            la tabla{" "}
            <code className="text-xs bg-muted px-1 rounded">public.users</code>.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/staff/login?next=/ai-settings">Ir a iniciar sesión</Link>
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
            Tu fila en{" "}
            <code className="text-xs bg-muted px-1 rounded">public.users</code> no
            tiene rol CEO. Pide a un administrador que ejecute en SQL:{" "}
            <code className="text-xs bg-muted px-1 rounded break-all">
              UPDATE public.users SET role = &apos;ceo&apos; WHERE email =
              &apos;tu@correo.com&apos;;
            </code>
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/staff/dashboard">Panel personal</Link>
          </Button>
          <Button variant="outline" onClick={() => void handleLogout()}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Ajustes de IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Claves de proveedor y modelo. Solo visible para CEO.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadSettings()}
            disabled={settingsLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${settingsLoading ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleLogout()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Inicio</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proveedores</CardTitle>
          <CardDescription>
            Las claves se guardan en la tabla{" "}
            <code className="text-xs bg-muted px-1 rounded">ai_settings</code>.
            Los campos sensibles pueden mostrarse u ocultarse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {settingsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            rows.map((row) => {
              const key = row.setting_key
              const v = values[key] ?? ""
              const secret = isSecretSetting(key)
              const show = visibleSecrets[key] ?? false

              if (key === "system_prompt") {
                return (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{labelForKey(key)}</Label>
                    {row.description && (
                      <p className="text-xs text-muted-foreground">
                        {row.description}
                      </p>
                    )}
                    <Textarea
                      id={key}
                      value={v}
                      onChange={(e) => updateValue(key, e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>
                )
              }

              if (key === "openai_model") {
                return (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{labelForKey(key)}</Label>
                    {row.description && (
                      <p className="text-xs text-muted-foreground">
                        {row.description}
                      </p>
                    )}
                    <Select
                      value={v || OPENAI_MODELS[0]}
                      onValueChange={(value) => updateValue(key, value)}
                    >
                      <SelectTrigger id={key} className="w-full max-w-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPENAI_MODELS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }

              if (key === "anthropic_model") {
                return (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{labelForKey(key)}</Label>
                    {row.description && (
                      <p className="text-xs text-muted-foreground">
                        {row.description}
                      </p>
                    )}
                    <Select
                      value={v || ANTHROPIC_MODELS[0]}
                      onValueChange={(value) => updateValue(key, value)}
                    >
                      <SelectTrigger id={key} className="w-full max-w-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ANTHROPIC_MODELS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }

              return (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{labelForKey(key)}</Label>
                  {row.description && (
                    <p className="text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  )}
                  <div className="flex gap-2 max-w-xl">
                    <Input
                      id={key}
                      type={secret && !show ? "password" : "text"}
                      value={v}
                      onChange={(e) => updateValue(key, e.target.value)}
                      className="font-mono text-sm"
                      autoComplete="off"
                    />
                    {secret && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setVisibleSecrets((prev) => ({
                            ...prev,
                            [key]: !show,
                          }))
                        }
                        aria-label={show ? "Ocultar valor" : "Mostrar valor"}
                      >
                        {show ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-between">
          <div className="text-sm min-h-[1.25rem]">
            {saveError && (
              <span className="text-destructive">{saveError}</span>
            )}
            {saveOk && !saveError && (
              <span className="text-primary">Cambios guardados.</span>
            )}
          </div>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={settingsLoading || saving || rows.length === 0}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar cambios
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
