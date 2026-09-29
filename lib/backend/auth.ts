'use client'

import { useSyncExternalStore } from 'react'
import { backendConfigured, getSupabase } from './client'

/**
 * Cloud identity, alongside the on-device PLACES account.
 *
 * When the backend is connected, joining and signing in also create a Supabase session,
 * which is what Row Level Security (and so rooms, presence and admin rights) is based on.
 * The rest of PLACES keeps working from the on-device world as before.
 */

export type BackendSession =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  /** `guest`: an anonymous session for dropping into rooms open to guests — not a PLACES account. */
  | { status: 'signed-in'; userId: string; email: string; accessToken: string; guest: boolean; name: string }

let session: BackendSession = backendConfigured ? { status: 'loading' } : { status: 'off' }
const listeners = new Set<() => void>()
const set = (next: BackendSession) => {
  session = next
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const getBackendSession = () => session
export const onBackendSessionChange = subscribe
const SERVER_SESSION: BackendSession = backendConfigured ? { status: 'loading' } : { status: 'off' }
export const useBackendSession = () => useSyncExternalStore(subscribe, getBackendSession, () => SERVER_SESSION)

let started = false
/** Starts listening to the cloud session. Safe to call more than once. */
export function initBackendAuth() {
  if (!backendConfigured || started || typeof window === 'undefined') return
  started = true
  getSupabase()
    .then(async (sb) => {
      const apply = (s: { user: { id: string; email?: string; is_anonymous?: boolean; user_metadata?: { name?: unknown } }; access_token: string } | null) =>
        set(
          s
            ? {
                status: 'signed-in',
                userId: s.user.id,
                email: s.user.email ?? '',
                accessToken: s.access_token,
                guest: !!s.user.is_anonymous,
                name: typeof s.user.user_metadata?.name === 'string' ? s.user.user_metadata.name : '',
              }
            : { status: 'signed-out' },
        )
      sb.auth.onAuthStateChange((_event, s) => apply(s))
      const { data } = await sb.auth.getSession()
      apply(data.session)
    })
    .catch((e) => {
      console.warn('PLACES: could not reach the backend', e)
      set({ status: 'signed-out' })
    })
}

export class BackendAuthError extends Error {}

const friendly = (message: string) => {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match.'
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Sign in instead.'
  if (/password/i.test(message) && /least|short|weak/i.test(message)) return 'Choose a password of at least 8 characters.'
  if (/email not confirmed/i.test(message)) return 'Confirm your email first — we sent you a link.'
  return message
}

export interface CloudProfile {
  name: string
  username: string
}

/** Creates the cloud identity. `confirmEmail` is true when the project requires email confirmation first. */
export async function backendSignUp(
  input: { email: string; password: string; location?: string; interests?: string[] } & CloudProfile,
): Promise<{ confirmEmail: boolean; userId: string | null }> {
  if (input.password.length < 8) throw new BackendAuthError('Choose a password of at least 8 characters.')
  const sb = await getSupabase()
  await leaveGuestSession(sb)
  const { data, error } = await sb.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { data: { name: input.name.trim(), username: input.username, location: input.location?.trim() ?? '', interests: input.interests ?? [] } },
  })
  if (error) throw new BackendAuthError(friendly(error.message))
  return { confirmEmail: !data.session, userId: data.user?.id ?? null }
}

export async function backendSignIn(email: string, password: string): Promise<CloudProfile & { email: string; userId: string }> {
  const sb = await getSupabase()
  await leaveGuestSession(sb)
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw new BackendAuthError(friendly(error.message))
  const meta = (data.user.user_metadata ?? {}) as Partial<CloudProfile>
  const address = data.user.email ?? email
  return { email: address, name: meta.name || address.split('@')[0], username: meta.username || '', userId: data.user.id }
}

/** A guest who joins or signs in stops being a guest first. */
async function leaveGuestSession(sb: Awaited<ReturnType<typeof getSupabase>>) {
  if (session.status === 'signed-in' && session.guest) await sb.auth.signOut().catch(() => {})
}

/** True while this device is in a room as a guest (no PLACES account). */
export const isGuestSession = (s: BackendSession = session) => s.status === 'signed-in' && s.guest

/**
 * Drops in as a guest with just a name: an anonymous session that can enter rooms open to guests and nothing else
 * (the database gives guests no profile). Needs "Allow anonymous sign-ins" on the Supabase project.
 */
export async function backendGuestSignIn(name: string) {
  const clean = name.trim().slice(0, 60)
  if (!clean) throw new BackendAuthError('Add your name so people know who’s here.')
  const sb = await getSupabase()
  if (session.status === 'signed-in') {
    if (session.guest && session.name !== clean) await sb.auth.updateUser({ data: { name: clean } })
    return
  }
  const { error } = await sb.auth.signInAnonymously({ options: { data: { name: clean } } })
  if (error) throw new BackendAuthError(/anonymous/i.test(error.message) ? 'Guest visits aren’t switched on yet. Join PLACES to come in — it’s free.' : friendly(error.message))
}

/** Whether a username is free in the shared world. */
export async function usernameAvailable(username: string): Promise<boolean> {
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('username_available', { p_username: username })
  if (error) return true // let sign-up itself decide
  return data === true
}

export async function backendSignOut() {
  if (!backendConfigured) return
  try {
    const sb = await getSupabase()
    await sb.auth.signOut()
  } catch (e) {
    console.warn('PLACES: cloud sign-out failed', e)
  }
}

/* ------------------------------------------------------------------ */
/* Admin rights — asked of the database (public.is_admin()), never assumed */
/* ------------------------------------------------------------------ */

export type AdminStatus = 'unknown' | 'checking' | 'admin' | 'not-admin'
let admin: { userId: string | null; status: AdminStatus } = { userId: null, status: 'unknown' }
const adminListeners = new Set<() => void>()
const setAdmin = (next: typeof admin) => {
  admin = next
  adminListeners.forEach((l) => l())
}

function checkAdmin(userId: string) {
  setAdmin({ userId, status: 'checking' })
  getSupabase()
    .then((sb) => sb.rpc('is_admin'))
    .then(({ data, error }) => {
      if (admin.userId !== userId) return
      setAdmin({ userId, status: !error && data === true ? 'admin' : 'not-admin' })
    })
    .catch(() => admin.userId === userId && setAdmin({ userId, status: 'not-admin' }))
}

const subscribeAdmin = (l: () => void) => {
  adminListeners.add(l)
  const unsub = subscribe(() => {
    const s = getBackendSession()
    if (s.status === 'signed-in' && admin.userId !== s.userId) checkAdmin(s.userId)
    if (s.status !== 'signed-in' && admin.userId !== null) setAdmin({ userId: null, status: 'not-admin' })
  })
  const s = getBackendSession()
  if (s.status === 'signed-in' && admin.userId !== s.userId) checkAdmin(s.userId)
  return () => {
    adminListeners.delete(l)
    unsub()
  }
}

const adminSnapshot = (): AdminStatus => {
  const s = getBackendSession()
  if (s.status === 'off' || s.status === 'signed-out') return 'not-admin'
  if (s.status === 'loading') return 'checking'
  return admin.userId === s.userId ? admin.status : 'checking'
}

/**
 * Whether the signed-in person is a PLACES admin, as reported by the database. This only decides
 * what the interface shows — every admin write is still checked by Row Level Security.
 */
export const useAdminStatus = () => useSyncExternalStore(subscribeAdmin, adminSnapshot, () => 'checking' as AdminStatus)
