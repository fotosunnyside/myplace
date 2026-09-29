import { get as idbGet, set as idbSet } from 'idb-keyval'
import { getBackendSession, initBackendAuth, onBackendSessionChange } from '@/lib/backend/auth'
import type { WorldState } from '@/lib/types'
import { toast } from '@/lib/ui'
import { getState, readDeviceWorld, replaceState } from '../store'
import { cloudChanges } from './diff'
import { CloudWriteError, WorldNotSetUp, loadCloud, watchWorld, writeOps } from './driver'
import { bringDeviceContent } from './import'
import { fromCloud, type CloudIdentity } from './map'

/**
 * Keeps the on-screen world and the shared world in step.
 *
 *  - Actions change the screen immediately; `commitToCloud` writes just the rows they changed, in order.
 *  - After writes land, and whenever anyone changes something this person can see, the world is re-read.
 *  - If the database refuses a write, people see why and the screen snaps back to what's really saved.
 */

let identity: CloudIdentity | null = null
let pending = 0
let queue: Promise<void> = Promise.resolve()
let timer: ReturnType<typeof setTimeout> | undefined
const accountWaiters = new Set<() => void>()

/* Whether changes are still on their way to the database (drives the "Saving…" hint and the leave-page guard). */
const savingListeners = new Set<() => void>()
export const isSaving = () => pending > 0
export const subscribeSaving = (l: () => void) => {
  savingListeners.add(l)
  return () => savingListeners.delete(l)
}
function setPending(n: number) {
  pending = n
  if (typeof document !== 'undefined') {
    if (n > 0) document.documentElement.dataset.saving = 'true'
    else delete document.documentElement.dataset.saving
  }
  savingListeners.forEach((l) => l())
}
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (pending > 0) e.preventDefault() // "Changes you made may not be saved."
  })
}

const currentIdentity = (): CloudIdentity | null => {
  const s = getBackendSession()
  return s.status === 'signed-in' ? { id: s.userId, email: s.email } : null
}

function sessionReady(): Promise<void> {
  return new Promise((resolve) => {
    if (getBackendSession().status !== 'loading') return resolve()
    const unsub = onBackendSessionChange(() => {
      if (getBackendSession().status !== 'loading') {
        unsub()
        resolve()
      }
    })
  })
}

/* A copy of the last world this device saw, so pages open instantly (then refresh from the database). */
const CACHE = 'places:cloud-world'
const cacheKey = (who: CloudIdentity | null) => who?.id ?? 'guest'

async function readCache(who: CloudIdentity | null): Promise<WorldState | null> {
  try {
    const c = (await idbGet(CACHE)) as { key: string; world: WorldState } | undefined
    return c && c.key === cacheKey(who) ? c.world : null
  } catch {
    return null
  }
}

function writeCache(who: CloudIdentity | null, world: WorldState) {
  idbSet(CACHE, { key: cacheKey(who), world }).catch(() => {})
}

let loading = false
let again = false

/**
 * Re-reads the world. One read at a time: changes that arrive during a read ask for one more read afterwards,
 * so a busy world can't starve anyone of an update.
 */
async function reload() {
  if (loading) {
    again = true
    return
  }
  loading = true
  try {
    do {
      again = false
      const who = identity
      const data = await loadCloud(!!who)
      if (who?.id !== identity?.id) {
        again = true // signed in or out meanwhile: read again as the new person
        continue
      }
      if (pending > 0) break // writes in flight; the write queue asks for a fresh read when it drains
      const world = fromCloud(data, who)
      replaceState(world)
      writeCache(who, world)
      accountWaiters.forEach((w) => w())
    } while (again)
  } finally {
    loading = false
  }
}

function schedule(delay = 350) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (pending > 0) return
    reload().catch((e) => console.warn('PLACES: could not refresh the world', e))
  }, delay)
}

/** Starts the shared world. Resolves 'device' when the database hasn't been set up yet. */
export async function startCloud(): Promise<'cloud' | 'device'> {
  initBackendAuth()
  await sessionReady()
  identity = currentIdentity()
  const cached = await readCache(identity)
  const fresh = loadCloud(!!identity).then((data) => {
    const world = fromCloud(data, identity)
    writeCache(identity, world)
    return world
  })
  if (cached) {
    // Show the last known world right away; the fresh copy replaces it moments later.
    replaceState(cached)
    fresh.then((w) => pending === 0 && replaceState(w)).catch((e) => console.warn('PLACES: could not refresh the world', e))
  } else {
    try {
      replaceState(await fresh)
    } catch (e) {
      if (e instanceof WorldNotSetUp) return 'device'
      throw e
    }
  }
  watchWorld(() => schedule())
  onBackendSessionChange(() => {
    const next = currentIdentity()
    if (next?.id === identity?.id) return
    identity = next
    reload()
      .then(() => next && importOnce(next))
      .catch((e) => console.warn('PLACES: could not load your world', e))
  })
  if (identity) void importOnce(identity)
  return 'cloud'
}

/** Writes what an action changed. Identity changes (signing in or out) are never data changes. */
export function commitToCloud(prev: WorldState, next: WorldState) {
  const ops = cloudChanges(prev, next, identity?.id ?? null)
  if (!ops.length || !identity) return
  const userId = identity.id
  setPending(pending + 1)
  queue = queue
    .then(() => writeOps(ops, userId))
    .catch((e) => {
      toast(e instanceof CloudWriteError ? e.message : 'We couldn’t save that. Please try again.', 'error')
    })
    .finally(() => {
      setPending(pending - 1)
      if (pending === 0) schedule(50)
    })
}

/** Resolves once the world shows this member signed in (after joining or signing in). */
export function waitForAccount(userId: string, timeoutMs = 20_000): Promise<boolean> {
  if (getState().accountId === userId) return Promise.resolve(true)
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      accountWaiters.delete(check)
      clearTimeout(t)
      resolve(ok)
    }
    const check = () => getState().accountId === userId && done(true)
    const t = setTimeout(() => done(false), timeoutMs)
    accountWaiters.add(check)
  })
}

/** Resolves when every pending write has landed (tests and sign-out use this). */
export const settled = () => queue

/* ------------------------------------------------------------------ */
/* Bringing a member's on-device content into the shared world, once    */
/* ------------------------------------------------------------------ */

const IMPORTED = 'places:imported:'

async function importOnce(who: CloudIdentity) {
  try {
    if (localStorage.getItem(IMPORTED + who.id)) return
    const device = await readDeviceWorld()
    localStorage.setItem(IMPORTED + who.id, '1')
    if (!device) return
    await waitForAccount(who.id)
    const current = getState()
    const merged = bringDeviceContent(current, device, who)
    if (merged === current) return
    replaceState(merged)
    commitToCloud(current, merged)
    toast('We brought what you made on this device into PLACES.')
  } catch (e) {
    console.warn('PLACES: could not bring device content across', e)
  }
}
