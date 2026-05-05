import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { JobsEditDashboard } from "@/components/jobs-edit-dashboard"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isManagerOrCeo } from "@/lib/profile-types"

export const metadata: Metadata = {
  title: "Empleos — administración | Avos",
  description: "Vacantes y solicitudes (manager / CEO).",
  robots: { index: false, follow: false },
}

export default async function JobsEditPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/staff/login?next=/jobs-edit")
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
        <div className="container mx-auto px-4 max-w-5xl">
          <JobsEditDashboard />
          <p className="text-center text-xs text-muted-foreground mt-10">
            <Link href="/staff/dashboard" className="underline underline-offset-2">
              Panel de personal
            </Link>
            {" · "}
            <Link href="/jobs" className="underline underline-offset-2">
              Ver página pública de empleos
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
