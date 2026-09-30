/** Music for a Virtual Place: YouTube videos, chosen by a PLACES Pass member, that anyone in the room can listen to. */

export interface MusicSuggestion {
  videoId: string
  title: string
  note: string
}

/** Long-running YouTube streams that suit working together. */
export const MUSIC_SUGGESTIONS: MusicSuggestion[] = [
  { videoId: 'jfKfPfyJRdk', title: 'Lofi beats to study & work', note: 'Lofi Girl · live' },
  { videoId: '5yx6BWlEVcY', title: 'Jazzy lofi beats', note: 'Chillhop Music · live' },
  { videoId: '4xDzrJKXOOY', title: 'Synthwave to focus', note: 'Lofi Girl · live' },
]

/** Where to find more ("work lofi beats" and similar playlists). */
export const MORE_MUSIC_URL = 'https://www.youtube.com/results?search_query=work+lofi+beats+playlist'

/** A YouTube video's id from a link (watch, youtu.be, shorts, live, embed) or a bare id; null otherwise. */
export function youtubeId(input: string): string | null {
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/)?.[1] ?? null
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

/**
 * The YouTube player, started where the room is up to (streams ignore the offset).
 * The regular youtube.com player (not the no-cookie one) so listeners signed in to YouTube Premium in
 * their browser get it ad-free.
 */
export function embedUrl(videoId: string, startedAt: string, now = Date.now()): string {
  const start = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&start=${start}`
}

/** Sign in to YouTube in a new tab; the room's player then uses that account (Premium: no ads). */
export const YOUTUBE_SIGN_IN_URL = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F'
