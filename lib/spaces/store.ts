'use client'

import { useSyncExternalStore } from 'react'
import { getBackendSession, onBackendSessionChange } from '@/lib/backend/auth'
import { backendConfigured } from '@/lib/backend/client'
import type { SpacesBackend } from './backend'
import { cloudBackend } from './cloud'
import { previewBackend } from './preview'
import { sortSpaces } from './rooms'
import type { VirtualSpace } from './types'

/** The one backend Virtual Spaces uses: the cloud when it's connected, the on-device preview otherwise. */
export const spacesBackend: SpacesBackend = backendConfigured ? cloudBackend : previewBackend

/* ------------------------------------------------------------------ */
/* A small live store: loads on first subscriber, refreshes on change   */
/* ------------------------------------------------------------------ */

type Live<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string; data?: T }

function liveStore<T>(load: () => Promise<T>, watch: (refresh: () => void) => () => void, pollMs: number) {
  let value: Live<T> = { status: 'loading' }
  const listeners = new Set<() => void>()
  let stop: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let inflight = false
  let again = false

  const emit = () => listeners.forEach((l) => l())
  const refresh = () => {
    if (inflight) {
      again = true
      return
    }
    inflight = true
    load()
      .then((data) => (value = { status: 'ready', data }))
      .catch((e: Error) => (value = { status: 'error', message: e.message, data: 'data' in value ? value.data : undefined }))
      .finally(() => {
        inflight = false
        emit()
        if (again) {
          again = false
          refresh()
        }
      })
  }
  // Realtime events arrive in bursts; coalesce them.
  const soon = () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, 250)
  }

  return {
    get: () => value,
    refresh,
    set(data: T) {
      value = { status: 'ready', data }
      emit()
    },
    subscribe(l: () => void) {
      listeners.add(l)
      if (!stop) {
        refresh()
        const unwatch = watch(soon)
        const poll = setInterval(refresh, pollMs)
        const onFocus = () => document.visibilityState === 'visible' && refresh()
        document.addEventListener('visibilitychange', onFocus)
        stop = () => {
          unwatch()
          clearInterval(poll)
          document.removeEventListener('visibilitychange', onFocus)
        }
      }
      return () => {
        listeners.delete(l)
        if (!listeners.size && stop) {
          stop()
          stop = null
        }
      }
    },
  }
}

const LOADING = { status: 'loading' } as const

export const spacesStore = liveStore(async () => sortSpaces(await spacesBackend.listSpaces()), (r) => spacesBackend.onSpacesChange(r), 60_000)

/** Every room the signed-in person can see, live. */
export const useSpaces = () => useSyncExternalStore(spacesStore.subscribe, spacesStore.get, () => LOADING as Live<VirtualSpace[]>)

/** Head-counts are polled too, so people who vanish without saying goodbye drop off within a minute. */
export const occupancyStore = liveStore(() => spacesBackend.occupancy(), (r) => spacesBackend.onOccupancyChange(r), 20_000)

/** Real participant counts by room id, or null while unknown (never a made-up number). */
export function useOccupancy(): Record<string, number> | null {
  const v = useSyncExternalStore(occupancyStore.subscribe, occupancyStore.get, () => LOADING as Live<Record<string, number>>)
  return 'data' in v && v.data ? v.data : null
}

// What someone may see depends on who they are: reload when they sign in or out.
if (typeof window !== 'undefined') {
  let last = ''
  onBackendSessionChange(() => {
    const s = getBackendSessionKey()
    if (s === last) return
    last = s
    spacesStore.refresh()
    occupancyStore.refresh()
  })
}

function getBackendSessionKey() {
  const s = getBackendSession()
  return s.status === 'signed-in' ? s.userId : s.status
}

/** Replace one room in the cache after an admin save, so the change shows before realtime echoes it back. */
export function applySpace(space: VirtualSpace) {
  const v = spacesStore.get()
  if (v.status !== 'ready') return spacesStore.refresh()
  spacesStore.set(sortSpaces(v.data.map((s) => (s.id === space.id ? space : s))))
}
