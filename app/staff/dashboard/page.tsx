import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StaffSignOutButton } from "@/components/staff-sign-out-button"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"

function roleLabel(role: string) {
  switch (role) {
    case "user":
      return "Cliente"
    case "staff":
      return "Staff"
    case "manager":
      return "Manager"
    case "ceo":
      return "CEO"
    default:
      return role
  }
}

export default async function StaffDashboardPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/staff/dashboard")
  }

  const first = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  let profileRow = first.data

  if (user && profileRow == null) {
    await supabase.rpc("ensure_my_public_user")
    const second = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
    profileRow = second.data
  }

  const profile = profileRow as StaffProfile | null

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-10 md:py-14">
        <div className="container mx-auto px-4 max-w-3xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1
                className="text-3xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Panel de personal
              </h1>
              <p className="text-muted-foreground mt-1">
                Mismo panel para todos los roles; luego podrás restringir
                secciones.
              </p>
            </div>
            <StaffSignOutButton />
          </div>

          {!profile ? (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-lg">Sin perfil público</CardTitle>
                <CardDescription>
                  No hay fila en <code className="text-xs">public.users</code> para
                  tu usuario. Ejecuta la migración SQL o pide a un admin que
                  ejecute el trigger / insert manual.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">
                    {profile.full_name || "Sin nombre"}
                  </CardTitle>
                  <Badge variant="secondary">{roleLabel(profile.role)}</Badge>
                </div>
                <CardDescription>{profile.email ?? user.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Roles: <strong>user</strong> (cliente), <strong>staff</strong>,{" "}
                  <strong>manager</strong>, <strong>ceo</strong>. Registro en{" "}
                  <Link href="/signup" className="text-primary underline">
                    /signup
                  </Link>{" "}
                  → <strong>user</strong>; registro personal →{" "}
                  <strong>staff</strong>.
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.role === "ceo" && (
                    <>
                      <Button asChild>
                        <Link href="/edit">Editar sitio</Link>
                      </Button>
                      <Button asChild variant="secondary">
                        <Link href="/ai-settings">Ajustes de IA</Link>
                      </Button>
                    </>
                  )}
                  <Button asChild variant="outline">
                    <Link href="/">Ir al sitio</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
