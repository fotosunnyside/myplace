import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/backend/client'
import type { Op } from './diff'
import { TABLE_ORDER, spec, type CloudData, type Row, type TableName } from './schema'

/** The world tables don't exist yet (the migration hasn't been run on this project). */
export class WorldNotSetUp extends Error {}

/** A write the database refused, with a message people can read. */
export class CloudWriteError extends Error {}

const MISSING = new Set(['PGRST205', '42P01', 'PGRST202'])

/** Everything the signed-in person (or a guest) can see, in one round of parallel reads. */
export async function loadCloud(signedIn: boolean): Promise<CloudData> {
  const sb = await getSupabase()
  const tables = TABLE_ORDER.filter((t) => signedIn || spec(t).public)
  const results = await Promise.all(
    tables.map(async (t) => {
      const s = spec(t)
      let q = sb.from(t).select('*')
      if (s.limit) q = q.order(s.limit.column, { ascending: false }).limit(s.limit.rows)
      const { data, error } = await q
      if (error) {
        if (MISSING.has(error.code)) throw new WorldNotSetUp(`Table ${t} is missing`)
        throw new Error(`${t}: ${error.message}`)
      }
      return [t, data ?? []] as const
    }),
  )
  const out = Object.fromEntries(TABLE_ORDER.map((t) => [t, [] as Row[]])) as CloudData
  for (const [t, rows] of results) out[t] = rows as Row[]
  return out
}

/* ------------------------------------------------------------------ */
/* Photos: data URLs become files in Storage before rows are written    */
/* ------------------------------------------------------------------ */

const uploaded = new Map<string, string>()

async function hash(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function uploadDataUrl(dataUrl: string, userId: string): Promise<string> {
  const known = uploaded.get(dataUrl)
  if (known) return known
  const match = /^data:(image\/(jpeg|png|webp|gif));base64,/.exec(dataUrl)
  if (!match) throw new CloudWriteError('That image format isn’t supported. Use JPEG, PNG or WebP.')
  const blob = await (await fetch(dataUrl)).blob()
  const ext = match[2] === 'jpeg' ? 'jpg' : match[2]
  const path = `${userId}/${await hash(dataUrl)}.${ext}`
  const sb = await getSupabase()
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: match[1], upsert: true, cacheControl: '31536000' })
  if (error) throw new CloudWriteError('We couldn’t upload that photo. Please try again.')
  const url = sb.storage.from('media').getPublicUrl(path).data.publicUrl
  uploaded.set(dataUrl, url)
  return url
}

async function withUploads(row: Row, userId: string): Promise<Row> {
  const out: Row = { ...row }
  for (const [k, v] of Object.entries(row)) if (typeof v === 'string' && v.startsWith('data:image/')) out[k] = await uploadDataUrl(v, userId)
  return out
}

/** Removes everything in the member's own photo folder (used when deleting an account). */
export async function removeMyMedia(userId: string) {
  const sb = await getSupabase()
  const { data } = await sb.storage.from('media').list(userId, { limit: 1000 })
  if (data?.length) await sb.storage.from('media').remove(data.map((f) => `${userId}/${f.name}`))
}

/* ------------------------------------------------------------------ */
/* Writing                                                              */
/* ------------------------------------------------------------------ */

const friendly = (table: TableName, e: { code?: string; message?: string }) => {
  const m = e.message ?? ''
  if (e.code === '23505') return table === 'applications' ? 'You already applied.' : table === 'shops' ? 'You already have a shop.' : 'That already exists.'
  if (e.code === 'P0001') return m
  if (e.code === '42501' || /row-level security/i.test(m)) {
    if (table === 'courses') return 'Choose Create in MindPlace or PLACES Pass to publish.'
    if (table === 'opportunities') return 'Posting is included with PLACES Pass — or pay the $3 posting fee.'
    if (table === 'enrollments') return 'Buy this course to start learning.'
    return 'You don’t have permission to do that.'
  }
  if (e.code === '23514' && /hosted rooms/i.test(m)) return m
  if (e.code === '23514') return 'Some details don’t look right. Please check and try again.'
  if (/fetch|network/i.test(m)) return 'We couldn’t reach PLACES. Check your connection.'
  return 'Something went wrong saving that. Please try again.'
}

export async function writeOps(ops: Op[], userId: string) {
  const sb = await getSupabase()
  for (const op of ops) {
    let error: { code?: string; message?: string } | null = null
    if (op.kind === 'insert') {
      const rows = await Promise.all(op.rows.map((r) => withUploads(r, userId)))
      // Columns a row leaves out take their database default (not null) in multi-row inserts.
      ;({ error } = await sb.from(op.table).insert(rows, { defaultToNull: false }))
    } else if (op.kind === 'update') {
      ;({ error } = await sb.from(op.table).update(await withUploads(op.values, userId)).match(op.match))
    } else {
      ;({ error } = await sb.from(op.table).delete().match(op.match))
    }
    if (error) {
      console.warn(`PLACES: ${op.kind} ${op.table} failed`, error)
      throw new CloudWriteError(friendly(op.table, error))
    }
  }
}

/* ------------------------------------------------------------------ */
/* Live updates                                                         */
/* ------------------------------------------------------------------ */

const IGNORE = new Set(['virtual_spaces', 'virtual_space_participants'])

/** Calls back whenever something anyone can see changes (row-level security filters what arrives). */
export function watchWorld(onChange: (table: string) => void): () => void {
  let channel: RealtimeChannel | null = null
  let closed = false
  getSupabase()
    .then((sb) => {
      if (closed) return
      channel = sb
        .channel(`world:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          if (!IGNORE.has(payload.table)) onChange(payload.table)
        })
        .subscribe()
    })
    .catch(() => {})
  return () => {
    closed = true
    if (channel) getSupabase().then((sb) => sb.removeChannel(channel!))
  }
}
