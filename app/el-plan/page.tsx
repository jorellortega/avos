import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ElPlanDashboard } from "@/components/el-plan-dashboard"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isStaffOrdersRole } from "@/lib/profile-types"
import {
  elPlanTodayDate,
  type ElPlanDayRow,
  type ElPlanItemRow,
} from "@/lib/el-plan-types"

export const metadata: Metadata = {
  title: "El plan | Avos",
  description: "Plan del día para el equipo — tareas y notas.",
  robots: { index: false, follow: false },
}

export default async function ElPlanPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/el-plan")
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
  if (!profile || !isStaffOrdersRole(profile.role)) {
    redirect("/staff/dashboard")
  }

  const planDate = elPlanTodayDate()

  const [{ data: dayRow, error: dayError }, { data: itemRows, error: itemsError }] =
    await Promise.all([
      supabase
        .from("el_plan_days")
        .select("*")
        .eq("plan_date", planDate)
        .maybeSingle(),
      supabase
        .from("el_plan_items")
        .select("*")
        .eq("plan_date", planDate)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true }),
    ])

  const loadError = dayError?.message ?? itemsError?.message ?? null
  const initialDay = (dayRow as ElPlanDayRow | null) ?? {
    plan_date: planDate,
    notes: "",
    created_at: "",
    updated_at: "",
  }
  const initialItems = (itemRows ?? []) as ElPlanItemRow[]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-3xl space-y-6">
          <div>
            <h1
              className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              El plan
            </h1>
            <p className="text-muted-foreground mt-2">
              Plan del día — revisa las tareas, márcalas y deja notas para el
              equipo.
            </p>
          </div>

          {loadError ? (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              No se pudo cargar ({loadError}). ¿Corriste la migración{" "}
              <code className="text-xs">el_plan</code> en Supabase?
            </p>
          ) : (
            <ElPlanDashboard
              userId={user.id}
              initialPlanDate={planDate}
              initialDay={initialDay}
              initialItems={initialItems}
            />
          )}

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/cocina" className="underline underline-offset-2">
              Cocina
            </Link>
            {" · "}
            <Link href="/preparados" className="underline underline-offset-2">
              Preparados
            </Link>
            {" · "}
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
