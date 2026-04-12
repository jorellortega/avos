import type { SupabaseClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"
import { createBrowserSupabase } from "@/lib/supabase/client"

/** @deprecated Prefer createBrowserSupabase from @/lib/supabase/client */
export function getBrowserSupabase(): SupabaseClient {
  return createBrowserSupabase()
}

/** CEO access: public.users.role, or legacy JWT metadata from older setups. */
export function isCeoAccess(
  user: User | null,
  profile: { role: string } | null,
): boolean {
  if (profile?.role === "ceo") return true
  if (!user) return false
  const um = user.user_metadata?.role
  const am = user.app_metadata?.role
  return um === "ceo" || am === "ceo"
}
