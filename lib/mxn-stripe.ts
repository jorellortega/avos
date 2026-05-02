/**
 * Stripe amounts for MXN are in centavos (1 MXN = 100). Menu and DB store pesos (e.g. 45.00).
 * @see https://docs.stripe.com/currencies
 */

/** Reject absurd unit prices (bad catalog / corrupt JSON) before charging. */
export const MXN_MAX_MENU_UNIT_PRICE = 25_000

export type MxnStripeAmountResult =
  | { ok: true; stripeUnitAmount: number }
  | { ok: false; reason: "nan" | "non_positive" | "too_large" }

/**
 * Converts one menu line unit price in MXN pesos to Stripe `unit_amount` (centavos).
 */
export function menuPesosMxnToStripeUnitAmount(pesos: number): MxnStripeAmountResult {
  if (!Number.isFinite(pesos)) return { ok: false, reason: "nan" }
  if (pesos <= 0) return { ok: false, reason: "non_positive" }
  if (pesos > MXN_MAX_MENU_UNIT_PRICE) return { ok: false, reason: "too_large" }
  const stripeUnitAmount = Math.round(pesos * 100)
  if (stripeUnitAmount < 1) return { ok: false, reason: "non_positive" }
  return { ok: true, stripeUnitAmount }
}
