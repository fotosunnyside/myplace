'use client'

import { Eye, EyeOff, Loader2, Music2, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, Card } from '@/components/ui/primitives'
import { addTrack, allTracks, removeTrack, setTrackActive } from '@/lib/spaces/library'
import { formatDuration, titleFromFile } from '@/lib/spaces/music'
import type { RoomTrack } from '@/lib/spaces/types'
import { cn } from '@/lib/cn'
import { AdminGate } from './AdminGate'

const field = 'h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm text-navy outline-none focus:border-teal/60'

/** /admin/music — the songs PLACES Pass members and hosts can play in their rooms. */
export function AdminMusic() {
  return (
    <AdminGate title="Room music" back={{ href: '/admin', label: 'Dashboard' }}>
      <MusicLibrary />
    </AdminGate>
  )
}

function MusicLibrary() {
  const [tracks, setTracks] = useState<RoomTrack[] | null>(null)
  const [error, setError] = useState('')
  const load = () =>
    allTracks().then(setTracks, (e: Error) => {
      setTracks([])
      setError(e.message)
    })
  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Library">
        <p className="-mt-4 mb-5 max-w-2xl text-navy-soft">
          These are the songs rooms can play. Only add music PLACES has the right to play for members in their rooms, and note where it’s from.
        </p>
        {tracks === null ? (
          <div className="h-40 animate-pulse rounded-panel bg-white/60" />
        ) : tracks.length === 0 ? (
          <Card className="p-8 text-center text-navy-soft">No songs yet. Upload the first one.</Card>
        ) : (
          <ul className="grid gap-2" data-testid="track-list">
            {tracks.map((t) => (
              <TrackRow key={t.id} track={t} onChange={load} onError={setError} />
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-[#a2412c]">
            {error}
          </p>
        )}
      </section>
      <UploadCard onAdded={load} />
    </div>
  )
}

function TrackRow({ track, onChange, onError }: { track: RoomTrack; onChange: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onChange()
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <li>
      <Card className={cn('flex flex-wrap items-center gap-3 p-4', !track.isActive && 'opacity-60')}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-wash text-teal-deep">
          <Music2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{track.title}</span>
          <span className="block truncate text-xs text-muted">
            {[track.artist, formatDuration(track.durationS), track.isActive ? null : 'Hidden'].filter(Boolean).join(' · ')}
          </span>
          {track.license && <span className="block truncate text-xs text-navy-soft">{track.license}</span>}
        </span>
        <audio src={track.url} controls preload="none" className="h-9 w-full sm:w-56" />
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => act(() => setTrackActive(track.id, !track.isActive))} aria-label={track.isActive ? `Hide ${track.title}` : `Show ${track.title}`}>
          {track.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Remove “${track.title}” from the library? Rooms playing it will stop.`)) void act(() => removeTrack(track))
          }}
          aria-label={`Remove ${track.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Card>
    </li>
  )
}

function UploadCard({ onAdded }: { onAdded: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [license, setLicense] = useState('')
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const reset = () => {
    setFile(null)
    setTitle('')
    setArtist('')
    setLicense('')
    setRights(false)
    if (input.current) input.current.value = ''
  }

  return (
    <Card className="h-fit p-5">
      <h2 className="font-serif text-2xl">Add a song</h2>
      <form
        className="mt-4 grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!file) return setError('Choose an audio file.')
          setBusy(true)
          setError('')
          setNote('')
          try {
            const t = await addTrack(file, { title, artist, license })
            setNote(`“${t.title}” is in the library.`)
            reset()
            onAdded()
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <input
          ref={input}
          type="file"
          accept="audio/*"
          aria-label="Audio file"
          className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-teal-wash file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal-deep"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            if (f && !title) setTitle(titleFromFile(f.name))
          }}
        />
        <label className="grid gap-1 text-sm">
          <span className="text-navy-soft">Title</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-navy-soft">Artist</span>
          <input className={field} value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={120} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-navy-soft">Source and licence</span>
          <input className={field} value={license} onChange={(e) => setLicense(e.target.value)} maxLength={300} placeholder="e.g. Composed for PLACES · all rights" required />
        </label>
        <label className="flex items-start gap-2 text-sm text-navy-soft">
          <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 h-4 w-4 accent-teal" required />
          <span>PLACES has the right to let members play this song in their rooms.</span>
        </label>
        <Button type="submit" disabled={busy || !file || !rights}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload song
        </Button>
        <p className="text-xs text-muted">MP3, M4A, AAC, OGG, WAV or WebM, up to 20 MB.</p>
        {note && (
          <p role="status" className="text-sm text-teal-deep">
            {note}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-[#a2412c]">
            {error}
          </p>
        )}
      </form>
    </Card>
  )
}
