"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createBrowserSupabase } from "@/lib/supabase/client"

function ClientLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/cuenta"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const supabase = createBrowserSupabase()
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signError) throw signError
      const safeNext = next.startsWith("/") ? next : "/cuenta"
      router.push(safeNext)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-md mx-auto w-full">
      <CardHeader>
        <CardTitle className="text-2xl" style={{ fontFamily: "var(--font-heading)" }}>
          Entrar
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Accede a tu cuenta para ver pedidos y ofertas.
        </p>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-login-email">Correo</Label>
            <Input
              id="client-login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-login-password">Contraseña</Label>
            <Input
              id="client-login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button type="submit" className="w-full sm:w-auto" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
          <Button variant="ghost" asChild type="button" className="w-full sm:w-auto">
            <Link href="/signup">Crear cuenta</Link>
          </Button>
        </CardFooter>
      </form>
      <CardFooter className="pt-0">
        <p className="text-xs text-muted-foreground w-full text-center">
          ¿Eres personal?{" "}
          <Link href="/staff/login" className="text-primary underline-offset-4 hover:underline">
            Entrar como staff
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center py-12 px-4">
        <Suspense
          fallback={
            <div className="flex justify-center w-full py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <ClientLoginForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
