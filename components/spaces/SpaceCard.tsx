'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Lock, Users } from 'lucide-react'
import { peopleHere, roomBehaviour, roomHref } from '@/lib/spaces/rooms'
import type { VirtualSpace } from '@/lib/spaces/types'
import { useRoomSession } from '@/lib/spaces/live'
import { withAuth } from '@/lib/store/hooks'
import { openToGuests } from '@/lib/spaces/guest'
import { cn } from '@/lib/cn'
import { RoomBackdrop } from './RoomBackdrop'

/** LIVE / CLOSED — the one status every room shows. */
export function RoomStatus({ live, className }: { live: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] shadow-soft backdrop-blur-md',
        live ? 'bg-white/90 text-teal-deep' : 'bg-navy/70 text-white',
        className,
      )}
    >
      {live ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
        </span>
      ) : (
        <Lock className="h-3 w-3" />
      )}
      {live ? 'Live' : 'Closed'}
    </span>
  )
}

/** A doorway into a room: its place, whether it's open, and who's there right now. */
export function SpaceCard({ space, count, size = 'lg' }: { space: VirtualSpace; count: number | null | undefined; size?: 'lg' | 'md' }) {
  const router = useRouter()
  const session = useRoomSession()
  const behaviour = roomBehaviour(space)
  const inside = session.space?.id === space.id && (session.phase === 'in-room' || session.phase === 'reconnecting')
  // Rooms open to guests take visitors straight to the door (name only); other rooms ask them to join first.
  const enter = () => (openToGuests(space) ? router.push(roomHref(space.slug, true)) : withAuth(() => router.push(roomHref(space.slug, true)), `Join PLACES to enter ${space.name}.`))

  return (
    <article
      className={cn(
        'group relative isolate flex flex-col justify-end overflow-hidden rounded-panel shadow-soft ring-1 ring-navy/5 transition duration-500 ease-gentle',
        space.isActive && 'hover:-translate-y-0.5 hover:shadow-lift',
        size === 'lg' ? 'min-h-[300px] md:min-h-[340px]' : 'min-h-[240px]',
      )}
    >
      <RoomBackdrop space={space} dim={false} fit="cover" className={cn('-z-10 transition duration-700 ease-gentle', space.isActive ? 'group-hover:scale-[1.03]' : 'grayscale-[0.6]')} />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_25%,rgb(18_59_74/0.72)_100%)]" />

      <div className="absolute left-4 top-4 flex items-center gap-2">
        <RoomStatus live={space.isActive} />
        {space.isActive && count != null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/55 px-2.5 py-1 text-[0.7rem] font-medium text-white backdrop-blur-md" data-testid="space-count">
            <Users className="h-3 w-3" /> {peopleHere(count)}
          </span>
        )}
      </div>

      <div className="p-5 text-white md:p-6">
        <h3 className="font-serif text-[1.9rem] leading-[1.05] md:text-[2.2rem]">{space.name}</h3>
        <p className="mt-1.5 max-w-md text-[0.95rem] leading-snug text-white/85">{space.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {space.isActive ? (
            <button
              onClick={enter}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-navy shadow-[0_10px_24px_-12px_rgb(0_0_0/0.5)] transition duration-300 ease-gentle hover:bg-cream active:scale-[0.98]"
            >
              {inside ? 'Return to the room' : behaviour.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <span className="inline-flex h-11 items-center rounded-full bg-white/20 px-5 text-sm font-medium text-white/90 backdrop-blur-md" aria-disabled="true">
              Closed for now
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
