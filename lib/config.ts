/**
 * Public, build-time configuration (safe to expose — Payment Links are public URLs).
 * Set these as GitHub repository variables; the Pages workflow passes them to the build.
 */
export const CREATOR_PLAN = {
  /** Monthly price in cents (display only; Stripe is the source of truth). */
  price: 200,
  /** Stripe Payment Link for the recurring creator subscription. Empty = test mode. */
  link: process.env.NEXT_PUBLIC_CREATOR_PLAN_LINK ?? '',
  /** Stripe customer portal login link, so creators can manage or cancel. */
  portal: process.env.NEXT_PUBLIC_STRIPE_PORTAL_LINK ?? '',
}
