/**
 * Pricing and public payment configuration — all in one place so the pricing model is easy to change.
 * Links are Stripe Payment Links (public URLs), set as GitHub repository variables and passed in at build time.
 * When a link is empty, that flow runs in clearly labelled test mode.
 */

/** Host courses in MindPlace. */
export const CREATOR_PLAN = {
  price: 300, // cents per month
  link: process.env.NEXT_PUBLIC_CREATOR_PLAN_LINK ?? '',
  /** Stripe customer portal login link, so creators can manage or cancel. */
  portal: process.env.NEXT_PUBLIC_STRIPE_PORTAL_LINK ?? '',
}

/** Post an opportunity in WorkPlace. */
export const JOB_POST = {
  price: 200, // cents per post
  link: process.env.NEXT_PUBLIC_JOB_POST_LINK ?? '',
}

/** One sponsored mini banner per Place. */
export const ADS = {
  week: { price: 1000, link: process.env.NEXT_PUBLIC_AD_WEEK_LINK ?? '' },
  month: { price: 3000, link: process.env.NEXT_PUBLIC_AD_MONTH_LINK ?? '' },
}

/** Sales admin fee on shipped items (see SALES_FEE_RATE in lib/store/actions.ts). No listing fees. */
export const SALES_FEE_LABEL = '1%'
