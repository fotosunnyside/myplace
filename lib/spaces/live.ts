'use client'

import { useSyncExternalStore } from 'react'
import { createMediaProvider } from './media'
import { RoomSession, type RoomSessionState } from './session'
import { spacesBackend, spacesStore } from './store'
import type { VirtualSpace } from './types'

/** Follows one room's configuration through the live rooms store (admin edits arrive via realtime). */
function watchSpace(spaceId: string, cb: (space: VirtualSpace | null) => void) {
  let last: VirtualSpace | null | undefined
  const check = () => {
    const v = spacesStore.get()
    if (v.status !== 'ready') return
    const next = v.data.find((s) => s.id === spaceId) ?? null
    if (next === last || (next && last && next.updatedAt === last.updatedAt)) return
    const first = last === undefined
    last = next
    if (!first) cb(next)
  }
  const unsub = spacesStore.subscribe(check)
  check()
  return unsub
}

/** The one room session for this tab. It outlives page navigation, so you stay in the room while you look around PLACES. */
export const roomSession = new RoomSession({ backend: spacesBackend, createMedia: createMediaProvider, watchSpace })

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => roomSession.leaveOnUnload())

const SERVER: RoomSessionState = roomSession.get()
export const useRoomSession = () => useSyncExternalStore(roomSession.subscribe, roomSession.get, () => SERVER)

/* ------------------------------------------------------------------ */
/* Remembered camera/mic preference (per device, a convenience only)     */
/* ------------------------------------------------------------------ */

const PREFS = 'places:spaces:devices'
export function devicePrefs(): { camera?: boolean; mic?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(PREFS) ?? '{}')
  } catch {
    return {}
  }
}
export function saveDevicePrefs(p: { camera?: boolean; mic?: boolean }) {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ ...devicePrefs(), ...p }))
  } catch {}
}
