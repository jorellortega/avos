import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ListaComprasClient } from "@/components/lista-compras-client"
import { createServerSupabase } from "@/lib/supabase/server"
import type { StaffProfile } from "@/lib/profile-types"
import { isStaffOrdersRole } from "@/lib/profile-types"

export const metadata: Metadata = {
  title: "Lista de compras | Avos",
  description: "Lista numerada para compras — marca artículos y totales.",
  robots: { index: false, follow: false },
}

type PageProps = {
  searchParams: Promise<{ t?: string | string[] }>
}

export default async function ListaComprasPage({ searchParams }: PageProps) {
  const params = await searchParams
  const rawToken = params.t
  const token =
    typeof rawToken === "string"
      ? rawToken.trim()
      : Array.isArray(rawToken)
        ? rawToken[0]?.trim() ?? ""
        : ""

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let canEditBudget = false
  if (user) {
    let { data: profileRow } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle()

    if (profileRow == null) {
      await supabase.rpc("ensure_my_public_user")
      const second = await supabase
        .from("users")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle()
      profileRow = second.data
    }

    const profile = profileRow as StaffProfile | null
    canEditBudget = Boolean(profile && isStaffOrdersRole(profile.role))
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-10">
        <div className="container mx-auto px-4 max-w-lg">
          <ListaComprasClient
            token={token || null}
            canEditBudget={canEditBudget}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
