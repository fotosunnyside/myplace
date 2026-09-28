import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The PLACES cloud backend (Supabase): auth, room configuration, presence, storage.
 *
 * Both values are public by design — the anon key only grants what Row Level Security allows.
 * Never put the service_role key or any provider secret in NEXT_PUBLIC_* variables.
 * When they're unset, features that need the cloud run in a clearly labelled on-device preview.
 */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

let client: Promise<SupabaseClient> | null = null

/** Loads supabase-js on first use, so pages that never touch the cloud don't pay for it. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!backendConfigured) return Promise.reject(new Error('The PLACES backend is not connected.'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'places:auth' },
      realtime: { params: { eventsPerSecond: 10 } },
    }),
  )
  return client
}
