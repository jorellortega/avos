import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ScheduleEditDashboard } from "@/components/schedule-edit-dashboard"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isManagerOrCeo } from "@/lib/profile-types"

export const metadata: Metadata = {
  title: "Horario de empleados | Avos",
  description: "Administrar horarios semanales (manager / CEO).",
  robots: { index: false, follow: false },
}

export default async function HorarioEditPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/horario-edit")
  }

  let { data: profileRow } = await supabase
    .from("users")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRow == null) {
    await supabase.rpc("ensure_my_public_user")
    const second = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .maybeSingle()
    profileRow = second.data
  }

  const profile = profileRow as StaffProfile | null
  if (!profile || !isManagerOrCeo(profile.role)) {
    redirect("/staff/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-6xl space-y-6">
          <div>
            <h1
              className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Horario de empleados
            </h1>
            <p className="text-muted-foreground mt-1">
              Lista de nombres con turnos por día. Copia el enlace de cada fila
              y envíaselo al empleado.
            </p>
          </div>
          <ScheduleEditDashboard />
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/staff/dashboard" className="underline underline-offset-2">
              Panel de personal
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
