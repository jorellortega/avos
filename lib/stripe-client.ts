import { loadStripe } from "@stripe/stripe-js"

/**
 * Browser Stripe.js (Payment Element, etc.). Hosted Checkout uses server redirect only.
 */
export function getStripeBrowser() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) return null
  return loadStripe(key)
}
