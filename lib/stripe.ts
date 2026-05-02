import Stripe from "stripe"

/** Stripe secret keys are a single token; Vercel/password-manager pastes sometimes include newlines. */
function normalizeStripeSecretKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return raw.replace(/\s+/g, "")
}

/**
 * Server-side Stripe client. Only available when STRIPE_SECRET_KEY is set.
 * Never import this file in client components.
 */
export function getStripe(): Stripe {
  const key = normalizeStripeSecretKey(process.env.STRIPE_SECRET_KEY)
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }
  return new Stripe(key)
}

export function isStripeConfigured(): boolean {
  return Boolean(normalizeStripeSecretKey(process.env.STRIPE_SECRET_KEY))
}
