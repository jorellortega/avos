import Stripe from "stripe"

/**
 * Server-side Stripe client. Only available when STRIPE_SECRET_KEY is set.
 * Never import this file in client components.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }
  return new Stripe(key)
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}
