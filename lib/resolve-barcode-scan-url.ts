/**
 * Build the absolute URL encoded in a QR code. Accepts full https URLs or paths like `/` or `/cuenta/ofertas`.
 */
export function resolveBarcodeScanUrl(baseUrl: string, target: string): string {
  const base = baseUrl.replace(/\/$/, "")
  const t = target.trim()
  if (!t) return `${base}/`
  if (/^https?:\/\//i.test(t)) return t
  const path = t.startsWith("/") ? t : `/${t}`
  return `${base}${path}`
}
