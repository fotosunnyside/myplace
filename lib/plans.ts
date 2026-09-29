'use client'

import { BASE_PATH } from './base-path'
import { PLANS } from './config'
import { activePlan, startPlan } from './store/actions'
import { perform, withAuth } from './store/hooks'
import { getState } from './store/store'
import type { PlanKind } from './types'
import { me } from './store/selectors'

/**
 * Starting a plan: Stripe checkout when its Payment Link is configured, otherwise a clearly labelled test plan.
 *
 * Stripe setup: point every plan link's confirmation page at `…/pricing/?plan=started` — PLACES then
 * finishes the plan the person chose (remembered on this device while they pay).
 */

const PENDING = 'places:pending-plan'
/** From before PLACES Pass: the creator plan's checkout (confirmation page `/teach/?subscribed=1`). */
const LEGACY_PENDING = 'places:pending-creator-plan'
const FRESH_MS = 2 * 60 * 60 * 1000

export const TEST_STARTED: Record<PlanKind, string> = {
  pass: 'Test PLACES Pass started.',
  host: 'Test Host a Space plan started.',
  create: 'Test Create in MindPlace plan started.',
}

/** Starts `kind` for the signed-in member (asking them to join first). `then` runs once a test plan is active. */
export function choosePlan(kind: PlanKind, then?: () => void) {
  withAuth(() => {
    const plan = PLANS[kind]
    const adding = kind === 'create' && !!activePlan(getState(), 'create')
    if (plan.link) {
      try {
        sessionStorage.setItem(PENDING, JSON.stringify({ kind, at: Date.now(), back: location.pathname.slice(BASE_PATH.length) + location.search }))
      } catch {}
      const email = me(getState())?.email
      window.location.href = plan.link + (email ? `?prefilled_email=${encodeURIComponent(email)}` : '')
      return
    }
    const what = adding ? 'adds one more course or membership to your test Create plan' : `starts a free test ${plan.name} plan`
    if (!confirm(`Stripe isn’t connected for ${plan.name} yet, so this ${what}. Continue?`)) return
    const r = perform((s, t) => startPlan(s, kind, 'test', t), adding ? 'One more course or membership added.' : TEST_STARTED[kind])
    if (r.ok) then?.()
  }, `Join PLACES to start ${PLANS[kind].name}.`)
}

/**
 * Back from Stripe: activates the plan the member chose. Returns where they were, or null if there was nothing to finish.
 * `legacy`: the old creator-plan confirmation page.
 */
export function finishPlanCheckout(legacy = false): string | null {
  try {
    if (legacy) {
      if (!sessionStorage.getItem(LEGACY_PENDING) || !getState().accountId) return null
      sessionStorage.removeItem(LEGACY_PENDING)
      perform((s, t) => startPlan(s, 'create', 'stripe', t), 'Create in MindPlace is active.')
      return '/teach'
    }
    const raw = sessionStorage.getItem(PENDING)
    if (!raw || !getState().accountId) return null
    const pending = JSON.parse(raw) as { kind: PlanKind; at: number; back?: string }
    sessionStorage.removeItem(PENDING)
    if (!(pending.kind in PLANS) || Date.now() - pending.at > FRESH_MS) return null
    perform((s, t) => startPlan(s, pending.kind, 'stripe', t), `Welcome to ${PLANS[pending.kind].name}!`)
    return pending.back || '/pricing'
  } catch {
    return null
  }
}
