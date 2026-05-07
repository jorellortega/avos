import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { JobsPublicSection } from "@/components/jobs-public-section"
import { createServerSupabase } from "@/lib/supabase/server"
import type { JobPostRow } from "@/lib/jobs-types"

export const metadata: Metadata = {
  title: "Empleos | Avos Mexican Grill",
  description: "Únete al equipo de Avos. Vacantes y solicitud en línea.",
}

export default async function JobsPage() {
  const supabase = await createServerSupabase()
  const { data: rows, error } = await supabase
    .from("job_posts")
    .select(
      "id, title, description, location, employment_type, pay, hours, is_active, sort_order, created_at, updated_at",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  const jobs = (error ? [] : rows) as JobPostRow[]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-10 md:py-14">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10 md:mb-12">
            <h1
              className="text-3xl md:text-4xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Trabaja con nosotros
            </h1>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Revisa las vacantes abajo y envía tu solicitud. Nos pondremos en contacto contigo.
            </p>
          </div>

          <JobsPublicSection jobs={jobs} loadError={Boolean(error)} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
