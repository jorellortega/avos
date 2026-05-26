"use client"

import dynamic from "next/dynamic"

const PortalPageClient = dynamic(
  () =>
    import("@/components/portal/portal-page-client").then((m) => m.PortalPageClient),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Cargando portal…</p>
      </div>
    ),
  },
)

export function PortalPageDynamic() {
  return <PortalPageClient />
}
