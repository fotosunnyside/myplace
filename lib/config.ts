/**
 * Pricing and public payment configuration — all in one place so the pricing model is easy to change.
 *
 * PLACES is free to join, explore, connect and take part in. People pay when they create, host,
 * sell professionally, hire or promote. Keep these in step with supabase/migrations/*_pricing.sql
 * (course fee, ad duration) and the Pricing page.
 *
 * Links are Stripe Payment Links (public URLs), set as GitHub repository variables and passed in at build time.
 * When a link is empty, that flow runs in clearly labelled test mode.
 */
import type { PlanKind } from './types'

export interface PlanInfo {
  kind: PlanKind
  name: string
  price: number // cents per month
  link: string
}

export const PLANS: Record<PlanKind, PlanInfo> = {
  /** Publish a course or membership in MindPlace — per published course or membership. */
  create: { kind: 'create', name: 'Create in MindPlace', price: 700, link: process.env.NEXT_PUBLIC_CREATE_PLAN_LINK ?? '' },
  /** Create your own Virtual Places (members' own rooms). */
  host: { kind: 'host', name: 'Create Virtual Places', price: 1100, link: process.env.NEXT_PUBLIC_HOST_PLAN_LINK ?? '' },
  /** One Pass. Every Place. */
  pass: { kind: 'pass', name: 'PLACES Pass', price: 2100, link: process.env.NEXT_PUBLIC_PASS_LINK ?? '' },
}

/** Stripe customer portal login link, so members can manage or cancel their plans. */
export const STRIPE_PORTAL = process.env.NEXT_PUBLIC_STRIPE_PORTAL_LINK ?? ''

/** PLACES platform fee on paid course enrollments and membership payments, without the Pass (the Pass is 0%). */
export const COURSE_FEE_RATE = 0.05
export const COURSE_FEE_LABEL = '5%'

/** Post an opportunity in WorkPlace (included with PLACES Pass). */
export const JOB_POST = {
  price: 300, // cents per post
  link: process.env.NEXT_PUBLIC_JOB_POST_LINK ?? '',
}

/** Sponsored placements: $10 a week per Place. Never included in the Pass. */
export const ADS = {
  week: { price: 1000, label: '1 week', link: process.env.NEXT_PUBLIC_AD_WEEK_LINK ?? '' },
  month: { price: 4000, label: '4 weeks', link: process.env.NEXT_PUBLIC_AD_MONTH_LINK ?? '' },
}

/** PLACES fee on shipped MarketPlace sales (SALES_FEE_RATE in lib/store/actions.ts). Local sales are free. Not removed by the Pass. */
export const SALES_FEE_LABEL = '1%'

/** Starting limits for members' own spaces (public.hosted_space_limits()). Not unlimited video. */
export const HOSTED_SPACES = { maxParticipants: 12, roomsPerHost: 5 }
