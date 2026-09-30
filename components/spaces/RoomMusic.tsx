'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Music2, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatDuration, playbackPosition } from '@/lib/spaces/music'
import { spacesBackend } from '@/lib/spaces/store'
import type { RoomMusic, RoomTrack } from '@/lib/spaces/types'
import { cn } from '@/lib/cn'

/**
 * Plays the room's track while you're listening, from where the room is up to, looping.
 * Rendered once per song: re-renders of the room don't touch it.
 */
export function MusicPlayer({ music, onClose }: { music: RoomMusic; onClose: () => void }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const el = audio.current
    if (!el) return
    const seek = () => {
      const duration = music.durationS ?? (Number.isFinite(el.duration) ? el.duration : null)
      el.currentTime = playbackPosition(music.startedAt, duration)
      el.play().then(
        () => setBlocked(false),
        () => setBlocked(true),
      )
    }
    if (el.readyState >= 1) seek()
    else el.addEventListener('loadedmetadata', seek, { once: true })
    return () => el.removeEventListener('loadedmetadata', seek)
  }, [music.trackId, music.startedAt, music.durationS])

  return (
    <div className="absolute bottom-[calc(118px+env(safe-area-inset-bottom))] left-3 z-30 flex w-[240px] items-center gap-2 rounded-2xl bg-navy/80 px-3 py-2 text-xs text-white shadow-lift ring-1 ring-white/15 backdrop-blur-xl md:bottom-[132px] md:left-6" data-testid="music-player">
      <Music2 className="h-3.5 w-3.5 shrink-0 text-aqua" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{music.title}</span>
        {music.artist && <span className="block truncate text-white/65">{music.artist}</span>}
      </span>
      {blocked && (
        <button onClick={() => audio.current?.play().then(() => setBlocked(false), () => {})} className="rounded-full bg-white/15 px-2 py-0.5 font-semibold hover:bg-white/25">
          Play
        </button>
      )}
      <button onClick={onClose} aria-label="Stop listening" className="rounded-full p-0.5 text-white/70 hover:text-white">
        <X className="h-3.5 w-3.5" />
      </button>
      <audio key={`${music.trackId}:${music.startedAt}`} ref={audio} src={music.url} loop preload="auto" />
    </div>
  )
}

/** Choose a track for the room (PLACES Pass or the room's host), or just listen in. */
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
  onPlay: (trackId: string | null) => Promise<void>
  onClose: () => void
}) {
  const [tracks, setTracks] = useState<RoomTrack[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!canPlay) return
    let live = true
    spacesBackend.tracks().then(
      (t) => live && setTracks(t),
      () => live && setTracks([]),
    )
    return () => {
      live = false
    }
  }, [canPlay])

  const play = async (trackId: string | null) => {
    setBusy(true)
    setError('')
    try {
      await onPlay(trackId)
      if (trackId) onListen(true)
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
      className="absolute bottom-[calc(112px+env(safe-area-inset-bottom))] left-1/2 z-40 max-h-[calc(100dvh-200px)] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-y-auto rounded-panel bg-white/95 p-4 text-navy shadow-lift backdrop-blur-xl md:bottom-[124px]"
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
            <span className="block truncate text-sm font-medium">{music.title}</span>
            {music.artist && <span className="block truncate text-xs text-muted">{music.artist}</span>}
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

      {canPlay ? (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Play for the room</p>
          {tracks === null ? (
            <div className="mt-2 h-24 animate-pulse rounded-xl bg-ivory" />
          ) : tracks.length === 0 ? (
            <p className="mt-2 text-sm text-navy-soft">The PLACES music library is being stocked. Check back soon.</p>
          ) : (
            <ul className="mt-2 grid gap-1">
              {tracks.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => play(t.id)}
                    disabled={busy}
                    className={cn('flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-ivory', music?.trackId === t.id && 'bg-teal-wash/60')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.title}</span>
                      {t.artist && <span className="block truncate text-xs text-muted">{t.artist}</span>}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">{formatDuration(t.durationS)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
