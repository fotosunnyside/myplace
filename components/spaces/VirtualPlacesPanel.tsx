'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Suspense } from 'react'
import { backendConfigured } from '@/lib/backend/client'
import { useRoomSession } from '@/lib/spaces/live'
import { roomHref } from '@/lib/spaces/rooms'
import { HostSpaces } from './HostSpaces'
import { LiveSpacesSection } from './LiveSpacesSection'

/**
 * Virtual Places, as a YourPlace tab (MyPlace used to hold these): the official rooms — Town Hall and the
 * Accountability Department — the Virtual Places members create, and a way back into the room you're in.
 */
export function VirtualPlacesPanel() {
  const session = useRoomSession()
  const inside = (session.phase === 'in-room' || session.phase === 'reconnecting') && session.space

  return (
    <div className="@container">
      {inside && (
        <Link
          href={roomHref(session.space!.slug)}
          className="mb-6 flex items-center justify-between gap-4 rounded-panel bg-navy px-5 py-4 text-white shadow-soft transition hover:bg-navy-soft"
        >
          <span>
            <span className="block text-[0.65rem] uppercase tracking-[0.2em] text-aqua">You’re in</span>
            <span className="font-serif text-2xl">{session.space!.name}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            Return <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      <LiveSpacesSection showAll={false} className="!px-0" />
      {!backendConfigured && (
        <p className="mt-3 text-center text-xs text-muted">Preview: rooms and presence run on this device until PLACES FOR US connects its live backend.</p>
      )}

      <Suspense>
        <HostSpaces />
      </Suspense>
    </div>
  )
}
