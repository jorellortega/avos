/**
 * Checkout / Stripe debugging (Vercel / local server logs).
 *
 * - **Summary** (`[checkout/order][summary]`): when `NODE_ENV=development` OR `CHECKOUT_DEBUG=1`.
 * - **Verbose** (`[checkout/order][debug]`): only when `CHECKOUT_DEBUG=1` (per-line amounts sent to Stripe).
 *
 * Stripe `amount_total` on sessions is in **centavos** (e.g. 4500 = 45.00 MXN).
 */

const summaryOn = () =>
  process.env.CHECKOUT_DEBUG === "1" || process.env.NODE_ENV === "development"

const verboseOn = () => process.env.CHECKOUT_DEBUG === "1"

export function checkoutOrderVerbose(label: string, data: Record<string, unknown>) {
  if (!verboseOn()) return
  try {
    console.info(`[checkout/order][debug] ${label}`, JSON.stringify(data))
  } catch {
    console.info(`[checkout/order][debug] ${label}`, data)
  }
}

export function checkoutOrderSummary(data: Record<string, unknown>) {
  if (!summaryOn()) return
  try {
    console.info("[checkout/order][summary]", JSON.stringify(data))
  } catch {
    console.info("[checkout/order][summary]", data)
  }
}
