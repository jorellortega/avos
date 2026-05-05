/**
 * Browser console debugging for checkout / cart sync.
 *
 * Enable either:
 * - `NEXT_PUBLIC_CHECKOUT_DEBUG=1` in env (rebuild), or
 * - In DevTools: `localStorage.setItem('avos_debug_checkout','1')` then reload.
 */

export function isCheckoutDebugClient(): boolean {
  if (process.env.NEXT_PUBLIC_CHECKOUT_DEBUG === "1") return true
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem("avos_debug_checkout") === "1"
  } catch {
    return false
  }
}

export function logCheckoutClient(tag: string, data: Record<string, unknown>) {
  if (!isCheckoutDebugClient()) return
  try {
    console.info(`[${tag}]`, JSON.stringify(data))
  } catch {
    console.info(`[${tag}]`, data)
  }
}
