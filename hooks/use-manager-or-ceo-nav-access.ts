"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { isManagerOrCeo } from "@/lib/profile-types"
import type { AppRole } from "@/lib/profile-types"

/** Signed-in manager or CEO: show /jobs-edit in nav. */
export function useManagerOrCeoNavAccess(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabase()

    async function refresh() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) {
        setAllowed(false)
        return
      }
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
      setAllowed(isManagerOrCeo(data?.role as AppRole | undefined))
    }

    void refresh()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh()
    })

    return () => subscription.unsubscribe()
  }, [])

  return allowed
}
