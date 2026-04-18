import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { createServerSupabase } from "@/lib/supabase/server"

export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.role && profile.role !== "user") {
      redirect("/staff/dashboard")
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 flex flex-wrap gap-x-6 gap-y-2 py-3 text-sm">
          <Link href="/cuenta" className="font-medium text-foreground hover:text-primary">
            Resumen
          </Link>
          <Link href="/cuenta/pedidos" className="font-medium text-muted-foreground hover:text-primary">
            Mis pedidos
          </Link>
          <Link href="/cuenta/ofertas" className="font-medium text-muted-foreground hover:text-primary">
            Ofertas
          </Link>
        </div>
      </div>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">{children}</main>
      <Footer />
    </div>
  )
}
