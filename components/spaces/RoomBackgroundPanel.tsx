'use client'

import { motion } from 'framer-motion'
import { Check, ImagePlus, Loader2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Picture } from '@/components/ui/Picture'
import { prepareBackground } from '@/lib/spaces/image'
import { defaultArtFor, ROOM_SCENES } from '@/lib/spaces/rooms'
import { applySpace, spacesBackend } from '@/lib/spaces/store'
import type { SpacePatch, VirtualSpace } from '@/lib/spaces/types'
import { cn } from '@/lib/cn'

/** The room's host changes its background from inside the room; everyone there sees it change. */
export function RoomBackgroundPanel({ space, onClose }: { space: VirtualSpace; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const current =
    space.backgroundStyle === 'none' ? 'none' : space.backgroundStyle === 'default' || !space.backgroundUrl ? 'default' : (ROOM_SCENES.find((s) => s.src === space.backgroundUrl)?.id ?? 'upload')

  const apply = async (key: string, patch: SpacePatch, uploadedPath: string | null = null) => {
    setBusy(key)
    setError('')
    try {
      applySpace(await spacesBackend.updateSpace(space.id, { focusX: 50, focusY: 50, ...patch }))
      // The old uploaded image is no longer used by anyone.
      if (space.backgroundPath && space.backgroundPath !== uploadedPath) spacesBackend.removeBackgroundObject(space.backgroundPath).catch(() => {})
    } catch (e) {
      if (uploadedPath) spacesBackend.removeBackgroundObject(uploadedPath).catch(() => {})
      setError((e as Error).message || 'That didn’t work. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy('upload')
    setError('')
    try {
      const blob = await prepareBackground(file)
      const up = await spacesBackend.uploadBackground(space.id, blob)
      await apply('upload', { backgroundStyle: 'custom', backgroundUrl: up.url, backgroundPath: up.path }, up.path)
    } catch (e) {
      setError((e as Error).message || 'That image didn’t upload. Try again.')
      setBusy(null)
    }
  }

  const tile = (key: string, label: string, src: string | null, onPick: () => void) => (
    <li key={key}>
      <button
        type="button"
        onClick={onPick}
        disabled={!!busy}
        aria-pressed={current === key}
        className={cn('group relative block w-full overflow-hidden rounded-xl text-left ring-2 transition disabled:opacity-70', current === key ? 'ring-teal' : 'ring-transparent hover:ring-teal/40')}
      >
        <span className="relative block aspect-[16/9] bg-[linear-gradient(180deg,#cfeef7_0%,#e9f6f3_55%,#fff9ef_100%)]">
          {src && <Picture src={src} alt="" fill sizes="160px" className="object-cover" />}
          {busy === key && (
            <span className="absolute inset-0 grid place-items-center bg-white/60">
              <Loader2 className="h-5 w-5 animate-spin text-teal-deep" />
            </span>
          )}
          {current === key && busy !== key && (
            <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-teal text-white">
              <Check className="h-3 w-3" />
            </span>
          )}
        </span>
        <span className="block px-1 py-1 text-xs font-medium">{label}</span>
      </button>
    </li>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      role="dialog"
      aria-label="Background"
      className="absolute bottom-[calc(112px+env(safe-area-inset-bottom))] left-1/2 z-40 max-h-[calc(100dvh-200px)] w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-y-auto rounded-panel bg-white/95 p-4 text-navy shadow-lift backdrop-blur-xl md:bottom-[124px]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Background</p>
        <button onClick={onClose} aria-label="Close background" className="rounded-full p-1 text-muted hover:text-navy">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted">Everyone in the room sees the change.</p>

      <ul className="mt-3 grid grid-cols-3 gap-2">
        {ROOM_SCENES.map((s) => tile(s.id, s.name, s.src, () => void apply(s.id, { backgroundStyle: 'custom', backgroundUrl: s.src, backgroundPath: null })))}
        {tile('default', 'Room default', defaultArtFor(space.roomType), () => void apply('default', { backgroundStyle: 'default', backgroundUrl: null, backgroundPath: null }))}
        {tile('none', 'Plain sky', null, () => void apply('none', { backgroundStyle: 'none', backgroundUrl: null, backgroundPath: null }))}
        {current === 'upload' && tile('upload', 'Your photo', space.backgroundUrl, () => {})}
      </ul>

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={!!busy}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-teal text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        Upload your own photo
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Background photo"
        data-testid="room-background-input"
        onChange={(e) => {
          void upload(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <p className="mt-1.5 text-center text-[0.7rem] text-muted">JPEG, PNG or WebP, at least 1280 px wide.</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#a2412c]">
          {error}
        </p>
      )}
    </motion.div>
  )
}
