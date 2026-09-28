import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, getSupabase } from '@/lib/backend/client'
import { getBackendSession } from '@/lib/backend/auth'
import type { MediaToken, SpacesBackend } from './backend'
import { patchToRow, presenceFromRow, spaceErrorCode, spaceFromRow, type PresenceRow, type SpaceRow } from './rows'
import { SPACE_MESSAGES, SpaceError, type SpacePatch } from './types'

export const BACKGROUND_BUCKET = 'virtual-space-backgrounds'

const fail = (err: { code?: string; message?: string } | null | undefined): never => {
  const code = spaceErrorCode(err)
  throw new SpaceError(code, code === 'unknown' && err?.message ? err.message : SPACE_MESSAGES[code])
}

type Result = { data: unknown; error: { code?: string; message?: string } | null }

async function call<T>(fn: (sb: SupabaseClient) => PromiseLike<Result>): Promise<T> {
  let sb: SupabaseClient
  try {
    sb = await getSupabase()
  } catch {
    throw new SpaceError('network', SPACE_MESSAGES.network)
  }
  let res: Result
  try {
    res = await fn(sb)
  } catch (e) {
    return fail({ message: (e as Error).message || 'network' })
  }
  if (res.error) fail(res.error)
  return res.data as T
}

let seq = 0
/** One realtime channel per listener; torn down when the listener unsubscribes. */
function listen(setup: (ch: RealtimeChannel) => RealtimeChannel, name: string): () => void {
  let channel: RealtimeChannel | null = null
  let closed = false
  getSupabase()
    .then((sb) => {
      if (closed) return
      channel = setup(sb.channel(`${name}:${++seq}`)).subscribe()
    })
    .catch(() => {})
  return () => {
    closed = true
    if (channel) getSupabase().then((sb) => sb.removeChannel(channel!))
  }
}

export const cloudBackend: SpacesBackend = {
  mode: 'cloud',

  async listSpaces() {
    const rows = await call<SpaceRow[]>((sb) => sb.from('virtual_spaces').select('*').order('sort_order'))
    return rows.map(spaceFromRow)
  },

  onSpacesChange(cb) {
    return listen((ch) => ch.on('postgres_changes', { event: '*', schema: 'public', table: 'virtual_spaces' }, () => cb()), 'spaces')
  },

  async occupancy() {
    const rows = await call<{ space_id: string; participant_count: number }[]>((sb) => sb.rpc('virtual_space_occupancy'))
    return Object.fromEntries(rows.map((r) => [r.space_id, r.participant_count]))
  },

  onOccupancyChange(cb) {
    // Arrivals and departures only — heartbeats are UPDATEs and don't change counts.
    return listen(
      (ch) =>
        ch
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'virtual_space_participants' }, () => cb())
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'virtual_space_participants' }, () => cb()),
      'occupancy',
    )
  },

  async roster(spaceId) {
    const rows = await call<PresenceRow[]>((sb) => sb.rpc('virtual_space_roster', { p_space_id: spaceId }))
    return rows.map(presenceFromRow)
  },

  onRosterChange(spaceId, cb) {
    return listen(
      (ch) => ch.on('postgres_changes', { event: '*', schema: 'public', table: 'virtual_space_participants', filter: `space_id=eq.${spaceId}` }, () => cb()),
      `roster:${spaceId}`,
    )
  },

  async join(spaceId, me) {
    await call((sb) =>
      sb.rpc('join_virtual_space', {
        p_space_id: spaceId,
        p_display_name: me.name,
        // Photos saved on this device are data URLs — only share hosted images.
        p_avatar_url: me.avatar && !me.avatar.startsWith('data:') ? me.avatar : null,
      }),
    )
  },

  async touch(spaceId, state) {
    const ok = await call<boolean>((sb) => sb.rpc('touch_virtual_space', { p_space_id: spaceId, p_camera_on: state.cameraOn, p_mic_on: state.micOn }))
    return ok === true
  },

  async leave(spaceId, opts) {
    const s = getBackendSession()
    if (opts?.keepalive && s.status === 'signed-in') {
      // Survives the tab closing, so people don't linger after they've gone.
      fetch(`${SUPABASE_URL}/rest/v1/rpc/leave_virtual_space`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_space_id: spaceId }),
      }).catch(() => {})
      return
    }
    await call((sb) => sb.rpc('leave_virtual_space', { p_space_id: spaceId }))
  },

  identity() {
    const s = getBackendSession()
    return s.status === 'signed-in' ? s.userId : null
  },

  async mediaToken(spaceId) {
    const sb = await getSupabase()
    const { data, error } = await sb.functions.invoke<MediaToken>('virtual-space-token', { body: { space_id: spaceId } })
    if (error) {
      const status = (error as { context?: Response }).context?.status
      if (status === 501 || status === 404) return null // no provider configured / function not deployed yet
      if (status === 403) throw new SpaceError('forbidden', 'Your place in this room has expired. Please enter again.')
      throw new SpaceError('network', 'We couldn’t connect live video right now.')
    }
    return data
  },

  async updateSpace(id, patch: SpacePatch) {
    const row = await call<SpaceRow | null>((sb) => sb.from('virtual_spaces').update(patchToRow(patch)).eq('id', id).select('*').maybeSingle())
    // RLS hides rows you can't change: no row back means no permission.
    if (!row) throw new SpaceError('forbidden', 'Only PLACES admins can change official rooms.')
    return spaceFromRow(row)
  },

  async uploadBackground(spaceId, file) {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp'
    const path = `${spaceId}/${Date.now()}.${ext}`
    await call((sb) => sb.storage.from(BACKGROUND_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false }))
    const sb = await getSupabase()
    return { path, url: sb.storage.from(BACKGROUND_BUCKET).getPublicUrl(path).data.publicUrl }
  },

  async removeBackgroundObject(path) {
    await call((sb) => sb.storage.from(BACKGROUND_BUCKET).remove([path]))
  },
}
