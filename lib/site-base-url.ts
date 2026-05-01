import { headers } from "next/headers"

/**
 * Canonical site origin for QR codes and redirects. Prefer `NEXT_PUBLIC_APP_URL` in production.
 */
export async function getSiteBaseUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/$/, "")
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const forwardedProto = h.get("x-forwarded-proto")
  const proto =
    forwardedProto ??
    (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https")
  if (host) return `${proto}://${host}`.replace(/\/$/, "")
  return "http://localhost:3000"
}
