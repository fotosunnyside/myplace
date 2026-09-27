import { del, get, set } from 'idb-keyval'
import type { WorldState } from '@/lib/types'
import { SEED_VERSION, SERVER_NOW, seedWorld } from './seed'

/**
 * Local-first world store.
 *
 * The whole world lives in memory and is persisted to IndexedDB on this device. It is the
 * single place data is read and written, so connecting a cloud backend later means
 * replacing `hydrate`/`persist` (and the pure actions with API calls) — not the UI.
 */

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
  state = next
  emit()
  persist()
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
    applications: saved.applications ?? [],
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

export function hydrate() {
  if (typeof window === 'undefined' || hydrated) return Promise.resolve()
  hydrating ??= load().then(() => {
    hydrated = true
    emit()
    persist()
    channel?.addEventListener('message', async () => {
      await load()
      emit()
    })
  })
  return hydrating
}

/** Wipes everything on this device and starts fresh. */
export async function resetDevice() {
  await del(KEY).catch(() => {})
  state = seedWorld(Date.now())
  emit()
  channel?.postMessage('changed')
}
