'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ExternalLink, Music2, Square, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { embedUrl, MORE_MUSIC_URL, MUSIC_SUGGESTIONS, YOUTUBE_SIGN_IN_URL, youtubeId } from '@/lib/spaces/music'
import type { RoomMusic } from '@/lib/spaces/types'
import { cn } from '@/lib/cn'

/**
 * The little player while you're listening. YouTube asks that players stay visible (at least 200×200-ish),
 * so it sits small in the corner rather than hidden.
 */
export function MusicPlayer({ music, onClose }: { music: RoomMusic; onClose: () => void }) {
  // Worked out once per song: recomputing the start time on every render would reload the player.
  const src = useMemo(() => embedUrl(music.videoId, music.startedAt), [music.videoId, music.startedAt])
  return (
    <div className="absolute bottom-[calc(118px+env(safe-area-inset-bottom))] left-3 z-30 w-[220px] overflow-hidden rounded-2xl bg-navy/80 text-white shadow-lift ring-1 ring-white/15 backdrop-blur-xl md:bottom-[132px] md:left-6" data-testid="music-player">
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <Music2 className="h-3.5 w-3.5 shrink-0 text-aqua" />
        <span className="min-w-0 flex-1 truncate">{music.title || 'Music for the room'}</span>
        <button onClick={onClose} aria-label="Stop listening" className="rounded-full p-0.5 text-white/70 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <iframe
        key={`${music.videoId}:${music.startedAt}`}
        src={src}
        title={music.title || 'Music for the room'}
        width={220}
        height={124}
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block"
      />
    </div>
  )
}

/** Choose music for the room (PLACES Pass), or just listen in. */
export function MusicPanel({
  music,
  canPlay,
  listening,
  onListen,
  onPlay,
  onClose,
}: {
  music: RoomMusic | null
  canPlay: boolean
  listening: boolean
  onListen: (on: boolean) => void
  onPlay: (videoId: string | null, title?: string) => Promise<void>
  onClose: () => void
}) {
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const play = async (videoId: string | null, title = '') => {
    setBusy(true)
    setError('')
    try {
      await onPlay(videoId, title)
      if (videoId) onListen(true)
      setLink('')
    } catch (e) {
      setError((e as Error).message || 'That didn’t work. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      role="dialog"
      aria-label="Music"
      className="absolute bottom-[calc(112px+env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-panel bg-white/95 p-4 text-navy shadow-lift backdrop-blur-xl md:bottom-[124px]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Music2 className="h-4 w-4 text-teal-deep" /> Music
        </p>
        <button onClick={onClose} aria-label="Close music" className="rounded-full p-1 text-muted hover:text-navy">
          <X className="h-4 w-4" />
        </button>
      </div>

      {music ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-ivory p-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted">Playing in the room</span>
            <span className="block truncate text-sm font-medium">{music.title || 'Music'}</span>
          </span>
          <button
            role="switch"
            aria-checked={listening}
            onClick={() => onListen(!listening)}
            className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition', listening ? 'bg-teal text-white' : 'bg-white text-teal-deep ring-1 ring-teal/30')}
          >
            {listening ? 'Listening' : 'Listen'}
          </button>
          {canPlay && (
            <button onClick={() => play(null)} disabled={busy} aria-label="Stop the music for everyone" title="Stop for everyone" className="shrink-0 rounded-full p-1.5 text-muted hover:text-coral">
              <Square className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-navy-soft">Nothing playing yet.</p>
      )}

      <a
        href={YOUTUBE_SIGN_IN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-start gap-2 rounded-2xl bg-ivory px-3 py-2 text-xs text-navy-soft hover:bg-sand"
      >
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-deep" />
        <span>
          <span className="font-semibold text-teal-deep">Sign in to YouTube</span> in this browser to hear it with your account. With YouTube Premium there are no ads. Each person’s own account decides their ads.
        </span>
      </a>

      {canPlay ? (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Play for the room</p>
          <ul className="mt-2 grid gap-1.5">
            {MUSIC_SUGGESTIONS.map((s) => (
              <li key={s.videoId}>
                <button
                  onClick={() => play(s.videoId, s.title)}
                  disabled={busy}
                  className={cn('flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-ivory', music?.videoId === s.videoId && 'bg-teal-wash/60')}
                >
                  <span>
                    <span className="block font-medium">{s.title}</span>
                    <span className="block text-xs text-muted">{s.note}</span>
                  </span>
                  <Music2 className="h-4 w-4 shrink-0 text-teal" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const id = youtubeId(link)
              if (!id) return setError('Paste a YouTube link (youtube.com or youtu.be).')
              void play(id, 'YouTube')
            }}
          >
            <label htmlFor="music-link" className="sr-only">
              YouTube link
            </label>
            <input
              id="music-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a YouTube link…"
              className="h-10 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            />
            <button type="submit" disabled={busy || !link.trim()} className="h-10 shrink-0 rounded-full bg-teal px-4 text-sm font-semibold text-white disabled:opacity-50">
              Play
            </button>
          </form>
          <a href={MORE_MUSIC_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-deep hover:underline">
            Find more work playlists on YouTube <ExternalLink className="h-3 w-3" />
          </a>
        </>
      ) : (
        <p className="mt-3 rounded-2xl bg-teal-wash/50 px-3 py-2 text-sm text-teal-deep">
          PLACES Pass members can play music for the room.{' '}
          <Link href="/pricing" className="font-semibold hover:underline">
            See the Pass
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#a2412c]">
          {error}
        </p>
      )}
    </motion.div>
  )
}
