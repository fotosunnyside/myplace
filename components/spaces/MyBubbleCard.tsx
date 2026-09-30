'use client'

import { motion } from 'framer-motion'
import { Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'

/** Your own bubble: its size (if the room allows), a status note on it, and whether your talking circle shows. */
export function MyBubbleCard({
  scale,
  status,
  allowResize,
  showRing,
  onScale,
  onStatus,
  onRing,
  className,
}: {
  scale: number
  status: string | null
  allowResize: boolean
  showRing: boolean
  onScale: (scale: number) => void
  onStatus: (status: string | null) => void
  onRing: (on: boolean) => void
  className?: string
}) {
  const [note, setNote] = useState(status ?? '')
  const step = (d: number) => onScale(Math.round(Math.min(1.8, Math.max(0.6, scale + d)) * 10) / 10)
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="dialog"
      aria-label="Your bubble"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn('z-30 w-60 rounded-2xl bg-white/95 p-3 text-left text-navy shadow-lift backdrop-blur-xl', className)}
    >
      <p className="font-semibold">Your bubble</p>

      {allowResize ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-navy-soft">Size</span>
          <span className="flex items-center gap-1.5">
            <button onClick={() => step(-0.2)} disabled={scale <= 0.6} aria-label="Smaller bubble" className="grid h-8 w-8 place-items-center rounded-full bg-ivory hover:bg-sand disabled:opacity-40">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-sm tabular-nums" aria-live="polite">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => step(0.2)} disabled={scale >= 1.8} aria-label="Bigger bubble" className="grid h-8 w-8 place-items-center rounded-full bg-ivory hover:bg-sand disabled:opacity-40">
              <Plus className="h-4 w-4" />
            </button>
          </span>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">This room keeps everyone’s bubble the same size.</p>
      )}

      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault()
          onStatus(note.trim() || null)
        }}
      >
        <label htmlFor="bubble-status" className="text-sm text-navy-soft">
          Status on your bubble
        </label>
        <div className="mt-1 flex gap-1.5">
          <input
            id="bubble-status"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={60}
            placeholder="e.g. Heads down until 3"
            className="h-9 min-w-0 flex-1 rounded-full border border-line bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
          />
          <button type="submit" className="h-9 shrink-0 rounded-full bg-teal px-3 text-sm font-semibold text-white">
            Set
          </button>
        </div>
        {status && (
          <button
            type="button"
            onClick={() => {
              setNote('')
              onStatus(null)
            }}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-navy"
          >
            <X className="h-3 w-3" /> Clear status
          </button>
        )}
      </form>

      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="text-navy-soft">Show my talking circle</span>
        <input type="checkbox" role="switch" checked={showRing} onChange={(e) => onRing(e.target.checked)} className="h-4 w-4 accent-teal" />
      </label>
    </motion.div>
  )
}
