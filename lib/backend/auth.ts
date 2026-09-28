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
  | { status: 'signed-in'; userId: string; email: string; accessToken: string }

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
      const apply = (s: { user: { id: string; email?: string }; access_token: string } | null) =>
        set(s ? { status: 'signed-in', userId: s.user.id, email: s.user.email ?? '', accessToken: s.access_token } : { status: 'signed-out' })
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
export async function backendSignUp(input: { email: string; password: string } & CloudProfile): Promise<{ confirmEmail: boolean }> {
  if (input.password.length < 8) throw new BackendAuthError('Choose a password of at least 8 characters.')
  const sb = await getSupabase()
  const { data, error } = await sb.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { data: { name: input.name.trim(), username: input.username } },
  })
  if (error) throw new BackendAuthError(friendly(error.message))
  return { confirmEmail: !data.session }
}

export async function backendSignIn(email: string, password: string): Promise<CloudProfile & { email: string }> {
  const sb = await getSupabase()
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw new BackendAuthError(friendly(error.message))
  const meta = (data.user.user_metadata ?? {}) as Partial<CloudProfile>
  const address = data.user.email ?? email
  return { email: address, name: meta.name || address.split('@')[0], username: meta.username || '' }
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
