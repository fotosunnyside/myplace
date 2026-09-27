'use client'

import { useSyncExternalStore } from 'react'

/** Tiny external stores for app-level UI: toasts and the sign-in dialog. */
function createStore<T>(initial: T) {
  let value = initial
  const ls = new Set<() => void>()
  return {
    get: () => value,
    set: (v: T) => {
      value = v
      ls.forEach((l) => l())
    },
    subscribe: (l: () => void) => {
      ls.add(l)
      return () => ls.delete(l)
    },
  }
}

/* ------------------------------------------------------------------ */
/* Toasts                                                               */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: number
  text: string
  tone: 'default' | 'error'
}

const toasts = createStore<Toast[]>([])
let nextToast = 1

export function toast(text: string, tone: Toast['tone'] = 'default') {
  const t = { id: nextToast++, text, tone }
  toasts.set([...toasts.get(), t].slice(-3))
  setTimeout(() => toasts.set(toasts.get().filter((x) => x.id !== t.id)), tone === 'error' ? 5000 : 3200)
}

const NO_TOASTS: Toast[] = []
export const useToasts = () => useSyncExternalStore(toasts.subscribe, toasts.get, () => NO_TOASTS)

/* ------------------------------------------------------------------ */
/* Sign-in dialog                                                       */
/* ------------------------------------------------------------------ */

export interface AuthRequest {
  mode: 'join' | 'signin'
  reason?: string
  onDone?: () => void
}

const auth = createStore<AuthRequest | null>(null)
export const openAuth = (req: AuthRequest) => auth.set(req)
export const closeAuth = () => auth.set(null)
export const useAuthRequest = () => useSyncExternalStore(auth.subscribe, auth.get, () => null)

/* ------------------------------------------------------------------ */
/* Create sheet                                                         */
/* ------------------------------------------------------------------ */

export type CreateKind = 'menu' | 'post' | 'discussion' | 'product' | 'opportunity' | null
const create = createStore<CreateKind>(null)
export const openCreate = (k: CreateKind = 'menu') => create.set(k)
export const closeCreate = () => create.set(null)
export const useCreate = () => useSyncExternalStore(create.subscribe, create.get, () => null)
