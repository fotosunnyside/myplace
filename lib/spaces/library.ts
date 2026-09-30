import { getSupabase } from '@/lib/backend/client'
import { checkTrackFile } from './music'
import { trackFromRow, type TrackRow } from './rows'
import type { RoomTrack } from './types'

/** The PLACES music library, managed by admins. The database only lets admins change it. */
export const MUSIC_BUCKET = 'room-music'

const fail = (e: { message?: string } | null) => {
  if (e) throw new Error(e.message || 'That didn’t work. Try again.')
}

/** Every track, hidden ones included (admins see all of them). */
export async function allTracks(): Promise<RoomTrack[]> {
  const sb = await getSupabase()
  const { data, error } = await sb.from('room_tracks').select('*').order('sort_order').order('title')
  fail(error)
  return (data as TrackRow[]).map(trackFromRow)
}

/** How long an audio file plays, read in the browser before upload; null if it can't be read. */
export function audioDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const a = new Audio()
    const done = (v: number | null) => {
      URL.revokeObjectURL(url)
      resolve(v)
    }
    a.preload = 'metadata'
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration > 0 ? Math.round(a.duration) : null)
    a.onerror = () => done(null)
    a.src = url
  })
}

export async function addTrack(file: File, meta: { title: string; artist: string; license: string }): Promise<RoomTrack> {
  const problem = checkTrackFile(file)
  if (problem) throw new Error(problem)
  const sb = await getSupabase()
  const ext = (file.name.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? 'mp3').toLowerCase()
  const path = `${crypto.randomUUID()}.${ext}`
  const up = await sb.storage.from(MUSIC_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  fail(up.error)
  const url = sb.storage.from(MUSIC_BUCKET).getPublicUrl(path).data.publicUrl
  const duration = await audioDuration(file)
  const { data, error } = await sb
    .from('room_tracks')
    .insert({ title: meta.title.trim(), artist: meta.artist.trim(), license: meta.license.trim(), path, url, duration_s: duration })
    .select('*')
    .single()
  if (error) {
    await sb.storage.from(MUSIC_BUCKET).remove([path])
    fail(error)
  }
  return trackFromRow(data as TrackRow)
}

export async function setTrackActive(id: string, isActive: boolean): Promise<void> {
  const sb = await getSupabase()
  fail((await sb.from('room_tracks').update({ is_active: isActive }).eq('id', id)).error)
}

export async function removeTrack(track: RoomTrack): Promise<void> {
  const sb = await getSupabase()
  fail((await sb.from('room_tracks').delete().eq('id', track.id)).error)
  await sb.storage.from(MUSIC_BUCKET).remove([track.path])
}
