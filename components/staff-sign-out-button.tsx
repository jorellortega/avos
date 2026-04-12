"use client"

import { useRouter } from "next/navigation"
import { LogOut, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { useState } from "react"

export function StaffSignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    setBusy(true)
    try {
      const supabase = createBrowserSupabase()
      await supabase.auth.signOut()
      router.push("/")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void signOut()}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      <span className="ml-2">Salir</span>
    </Button>
  )
}
