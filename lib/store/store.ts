import { del, get, set } from 'idb-keyval'
import type { WorldState } from '@/lib/types'
import { backendConfigured } from '@/lib/backend/client'
import { SEED_VERSION, SERVER_NOW, seedWorld } from './seed'
import { commitToCloud, startCloud } from './cloud/sync'

/**
 * The world store: the single place the interface reads and changes PLACES.
 *
 * Two homes for the data, same interface:
 *  - 'cloud'  — the shared world in Supabase (when the backend is connected). Actions apply instantly on
 *               screen, their changes are written to the database, and the world refreshes live.
 *  - 'device' — everything in this browser's IndexedDB (the preview, or before the database is set up).
 */

export type WorldMode = 'device' | 'cloud'
let mode: WorldMode = 'device'
export const getWorldMode = () => mode

const KEY = 'places:world'
const CHANNEL = 'places:world'

/** Stable snapshot used for server rendering and the very first client render. */
export const SERVER_STATE: WorldState = seedWorld(SERVER_NOW)

let state: WorldState = SERVER_STATE
let hydrated = false
let hydrating: Promise<void> | null = null
const listeners = new Set<() => void>()
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null

const emit = () => listeners.forEach((l) => l())

export const getState = () => state
export const isHydrated = () => hydrated

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let writing = false
let dirty = false
/** Writes immediately; if a write is in flight, writes once more when it finishes. */
function persist() {
  if (typeof window === 'undefined') return
  if (writing) {
    dirty = true
    return
  }
  writing = true
  set(KEY, state)
    .then(() => channel?.postMessage('changed'))
    .catch((e) => console.warn('PLACES: could not save to this device', e))
    .finally(() => {
      writing = false
      if (dirty) {
        dirty = false
        persist()
      }
    })
}

export function setState(next: WorldState) {
  if (next === state) return
  const prev = state
  state = next
  emit()
  if (mode === 'cloud') commitToCloud(prev, next)
  else persist()
}

/** Replaces the world with what the server says, without writing anything back. */
export function replaceState(next: WorldState) {
  state = next
  emit()
}

/** Keep people's own content when the seed changes; refresh everything else. */
export function migrate(saved: WorldState, now: number): WorldState {
  if (saved.version === SEED_VERSION) return saved
  const fresh = seedWorld(now)
  const mine = new Set(saved.accounts.map((a) => a.id))
  const myShops = new Set(saved.shops.filter((x) => mine.has(x.ownerId)).map((x) => x.id))
  return {
    ...fresh,
    accountId: saved.accountId,
    accounts: saved.accounts,
    following: saved.following ?? {},
    enrollments: saved.enrollments ?? {},
    saved: saved.saved ?? {},
    collections: saved.collections ?? {},
    notifications: saved.notifications ?? {},
    orders: saved.orders ?? [],
    coursePurchases: saved.coursePurchases ?? [],
    courses: [...(saved.courses ?? []).filter((c) => mine.has(c.expertId)), ...fresh.courses],
    applications: saved.applications ?? [],
    ads: saved.ads ?? [],
    contracts: saved.contracts ?? [],
    workrooms: saved.workrooms ?? [],
    threads: saved.threads ?? [],
    posts: [...saved.posts.filter((p) => mine.has(p.authorId)), ...fresh.posts],
    discussions: [...saved.discussions.filter((d) => mine.has(d.authorId)), ...fresh.discussions],
    shops: [...fresh.shops, ...saved.shops.filter((x) => mine.has(x.ownerId))],
    products: [...saved.products.filter((p) => myShops.has(p.shopId)), ...fresh.products],
    opportunities: [...saved.opportunities.filter((o) => mine.has(o.postedById)), ...fresh.opportunities],
  }
}

async function load() {
  try {
    const saved = (await get(KEY)) as WorldState | undefined
    state = saved ? migrate(saved, Date.now()) : seedWorld(Date.now())
  } catch {
    state = seedWorld(Date.now()) // private mode / storage blocked: still fully usable for this visit
  }
}

function startDevice() {
  return load().then(() => {
    hydrated = true
    emit()
    persist()
    channel?.addEventListener('message', async () => {
      if (mode !== 'device') return
      await load()
      emit()
    })
  })
}

export function hydrate() {
  if (typeof window === 'undefined' || hydrated) return Promise.resolve()
  hydrating ??= (async () => {
    if (backendConfigured) {
      const started = await startCloud().catch((e) => {
        console.warn('PLACES: shared world unavailable, using this device', e)
        return 'device' as const
      })
      if (started === 'cloud') {
        mode = 'cloud'
        hydrated = true
        emit()
        return
      }
    }
    await startDevice()
  })()
  return hydrating
}

/** Reads what's saved on this device without touching the live world (used to bring device content into the cloud). */
export async function readDeviceWorld(): Promise<WorldState | null> {
  try {
    return ((await get(KEY)) as WorldState | undefined) ?? null
  } catch {
    return null
  }
}

/** Wipes everything on this device and starts fresh. */
export async function resetDevice() {
  await del(KEY).catch(() => {})
  state = seedWorld(Date.now())
  emit()
  channel?.postMessage('changed')
}
