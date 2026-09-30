/** Music for a Virtual Place: tracks from the PLACES library, chosen by a PLACES Pass member or the room's host. */

/**
 * Where in the track the room is up to, in seconds, so everyone who listens hears the same part.
 * Tracks loop; without a known length, start from the beginning.
 */
export function playbackPosition(startedAt: string, durationS: number | null, now = Date.now()): number {
  const elapsed = Math.max(0, (now - Date.parse(startedAt)) / 1000)
  if (!durationS || !Number.isFinite(elapsed)) return 0
  return elapsed % durationS
}

/** "3:07" */
export function formatDuration(s: number | null): string {
  if (!s || s < 0) return ''
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/** A track's title without the file extension or separators, for the upload form. */
export function titleFromFile(name: string): string {
  return name
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

export const TRACK_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm'] as const
export const TRACK_MAX_BYTES = 20 * 1024 * 1024

export function checkTrackFile(file: { type: string; size: number }): string | null {
  if (!(TRACK_TYPES as readonly string[]).includes(file.type)) return 'Choose an MP3, M4A, AAC, OGG, WAV or WebM audio file.'
  if (file.size > TRACK_MAX_BYTES) return 'That file is over 20 MB.'
  return null
}
