"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { AppRole } from "@/lib/profile-types"

export type AccountRoleState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "ready"; role: AppRole }

/**
 * Current Supabase session + `public.users.role` (client vs staff nav).
 */
export function useAppUserRole(): AccountRoleState {
  const [state, setState] = useState<AccountRoleState>({ status: "loading" })

  useEffect(() => {
    const supabase = createBrowserSupabase()

    const apply = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        setState({ status: "anon" })
        return
      }
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle()
      setState({ status: "ready", role: (data?.role as AppRole) ?? "user" })
    }

    void apply()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void apply()
    })
    return () => subscription.unsubscribe()
  }, [])

  return state
}
