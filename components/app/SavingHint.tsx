'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { isSaving, subscribeSaving } from '@/lib/store/cloud/sync'

/** A quiet "Saving…" while changes travel to PLACES (only if it takes long enough to notice). */
export function SavingHint() {
  const saving = useSyncExternalStore(subscribeSaving, isSaving, () => false)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!saving) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hide as soon as saving ends
      setShow(false)
      return
    }
    const t = setTimeout(() => setShow(true), 600)
    return () => clearTimeout(t)
  }, [saving])
  if (!show) return null
  return (
    <div role="status" className="pointer-events-none fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-4 z-[65] inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-medium text-navy-soft shadow-soft md:bottom-6 md:left-6">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-teal" /> Saving…
    </div>
  )
}
