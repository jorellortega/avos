"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createBrowserSupabase } from "@/lib/supabase/client"

export function StaffAuthLinks() {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const supabase = createBrowserSupabase()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(!!session?.user)
      setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!ready) {
    return <span className="inline-block w-14 h-5" aria-hidden />
  }

  const className =
    "text-foreground/80 hover:text-primary transition-colors font-medium"

  if (signedIn) {
    return (
      <Link href="/staff/dashboard" className={className}>
        Personal
      </Link>
    )
  }

  return (
    <Link href="/staff/login" className={className}>
      Personal
    </Link>
  )
}
