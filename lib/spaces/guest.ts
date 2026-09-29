'use client'

import { useSyncExternalStore } from 'react'
import { backendGuestSignIn, getBackendSession, onBackendSessionChange } from '@/lib/backend/auth'
import { backendConfigured } from '@/lib/backend/client'

/**
 * Guests: people who drop into a room that's open to guests with just a name — no PLACES account.
 * With the backend this is an anonymous Supabase session; on-device it's a name kept for this browser tab.
 */

export interface Guest {
  id: string
  name: string
}

const KEY = 'places:guest'
const listeners = new Set<() => void>()
let cached: Guest | null | undefined

function readLocal(): Guest | null {
  if (cached !== undefined) return cached
  try {
    cached = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Guest | null
  } catch {
    cached = null
  }
  return cached
}

/** The on-device guest (preview mode only). */
export const previewGuest = () => (typeof window === 'undefined' ? null : readLocal())

function current(): Guest | null {
  if (!backendConfigured) return previewGuest()
  const s = getBackendSession()
  return s.status === 'signed-in' && s.guest ? { id: s.userId, name: s.name || 'Guest' } : null
}

let snapshot: Guest | null = null
const read = () => {
  const next = current()
  if (next?.id !== snapshot?.id || next?.name !== snapshot?.name) snapshot = next
  return snapshot
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  const off = onBackendSessionChange(l)
  return () => {
    listeners.delete(l)
    off()
  }
}

/** The guest on this device, if they dropped in without an account. */
export const useGuest = () => useSyncExternalStore(subscribe, read, () => null)

/** Drop in as a guest with just a name. Throws BackendAuthError with a friendly message. */
export async function dropInAsGuest(name: string) {
  const clean = name.trim().slice(0, 60)
  if (backendConfigured) return backendGuestSignIn(clean)
  if (!clean) throw new Error('Add your name so people know who’s here.')
  const guest = { id: previewGuest()?.id ?? `guest_${crypto.randomUUID().slice(0, 12)}`, name: clean }
  cached = guest
  try {
    sessionStorage.setItem(KEY, JSON.stringify(guest))
  } catch {}
  listeners.forEach((l) => l())
}

/** Rooms a guest may enter. */
export const openToGuests = (space: { visibility: string }) => space.visibility === 'public'
