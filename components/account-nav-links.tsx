"use client"

import Link from "next/link"
import { useAppUserRole } from "@/hooks/use-app-user-role"
import { isStaffOrdersRole } from "@/lib/profile-types"

/**
 * Header links: Entrar / Registrarse (invitado), Mi cuenta (cliente), Panel personal /staff/dashboard (staff+).
 */
export function AccountNavLinks() {
  const state = useAppUserRole()

  const className =
    "text-foreground/80 hover:text-primary transition-colors font-medium"

  if (state.status === "loading") {
    return <span className="inline-block w-24 h-5" aria-hidden />
  }

  if (state.status === "anon") {
    return (
      <div className="flex items-center gap-4">
        <Link href="/login" className={className}>
          Entrar
        </Link>
        <Link href="/signup" className={className}>
          Registrarse
        </Link>
      </div>
    )
  }

  if (isStaffOrdersRole(state.role)) {
    return (
      <Link href="/staff/dashboard" className={className}>
        Panel personal
      </Link>
    )
  }

  return (
    <Link href="/cuenta" className={className}>
      Mi cuenta
    </Link>
  )
}
