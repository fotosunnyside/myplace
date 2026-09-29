'use client'

import { useSyncExternalStore } from 'react'
import type { WorldState } from '@/lib/types'
import { openAuth, toast } from '@/lib/ui'
import { ActionError } from './actions'
import { SERVER_NOW } from './seed'
import { SERVER_STATE, getState, hydrate, isHydrated, setState, subscribe } from './store'
import { me } from './selectors'

export const useWorld = (): WorldState => useSyncExternalStore(subscribe, getState, () => SERVER_STATE)

export const useHydrated = () => useSyncExternalStore(subscribe, isHydrated, () => false)

export const useMe = () => me(useWorld())

/* ------------------------------------------------------------------ */
/* A clock that is stable during hydration, then ticks every minute     */
/* ------------------------------------------------------------------ */

let clock = typeof window === 'undefined' ? SERVER_NOW : Date.now()
const tickers = new Set<() => void>()
let interval: ReturnType<typeof setInterval> | undefined
const subscribeClock = (l: () => void) => {
  tickers.add(l)
  interval ??= setInterval(() => {
    clock = Date.now()
    tickers.forEach((t) => t())
  }, 60_000)
  return () => tickers.delete(l)
}
export const useNow = () => useSyncExternalStore(subscribeClock, () => clock, () => SERVER_NOW)

/* ------------------------------------------------------------------ */
/* Performing actions                                                   */
/* ------------------------------------------------------------------ */

type Result = WorldState | { state: WorldState; id: string }

/**
 * Runs a pure action against the current world. Validation errors become friendly toasts.
 * Returns `{ ok, id }` so callers can navigate to something they just created.
 */
export function perform(fn: (s: WorldState, now: number) => Result, success?: string): { ok: boolean; id?: string } {
  try {
    const r = fn(getState(), Date.now())
    const isWrapped = 'state' in r && 'id' in r
    setState(isWrapped ? r.state : (r as WorldState))
    if (success) toast(success)
    return { ok: true, id: isWrapped ? r.id : undefined }
  } catch (e) {
    if (e instanceof ActionError) {
      toast(e.message, 'error')
      return { ok: false }
    }
    throw e
  }
}

/** Runs `cb` now if signed in, otherwise after the person joins or signs in. */
export function withAuth(cb: () => void, reason?: string) {
  // Clicked before the saved session loaded: decide once it has, so members aren't asked to join.
  if (!isHydrated()) return void hydrate().then(() => withAuth(cb, reason))
  if (getState().accountId) cb()
  else openAuth({ mode: 'join', reason, onDone: cb })
}
