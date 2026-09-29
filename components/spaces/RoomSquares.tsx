'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Plus, Users } from 'lucide-react'
import { featuredSpaces, roomHref, CREATE_PLACE_HREF, PLACES_HREF } from '@/lib/spaces/rooms'
import { useRoomSession } from '@/lib/spaces/live'
import { useOccupancy, useSpaces } from '@/lib/spaces/store'
import type { VirtualSpace } from '@/lib/spaces/types'
import { withAuth } from '@/lib/store/hooks'
import { openToGuests } from '@/lib/spaces/guest'
import { cn } from '@/lib/cn'
import { RoomBackdrop } from './RoomBackdrop'

/**
 * The official PLACES rooms as small squares under the profile panel on YourPlace:
 * one tap into the Accountability Department or Town Hall, without taking over the page.
 */
export function RoomSquares({ className }: { className?: string }) {
  const spaces = useSpaces()
  const occupancy = useOccupancy()
  const list = 'data' in spaces && spaces.data ? featuredSpaces(spaces.data) : []

  if (spaces.status === 'loading')
    return (
      <div className={cn('grid gap-2 @3xl:gap-3', className)} aria-busy="true" aria-label="Loading rooms">
        {[0, 1].map((i) => (
          <div key={i} className="aspect-square animate-pulse rounded-card bg-white/60" />
        ))}
      </div>
    )
  if (!list.length) return null

  return (
    <section aria-label="Official Virtual Places" className={cn('grid gap-2 @3xl:gap-3', className)}>
      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted @3xl:text-xs">Virtual Places · free to join</p>
      {list.map((s) => (
        <RoomSquare key={s.id} space={s} count={occupancy ? (occupancy[s.id] ?? 0) : null} />
      ))}
      <Link
        href={CREATE_PLACE_HREF}
        className="flex items-center justify-center gap-1 rounded-card border border-dashed border-teal/40 bg-teal-wash/40 px-2 py-2.5 text-center text-[0.6rem] font-semibold text-teal-deep transition hover:bg-teal-wash @3xl:py-3.5 @3xl:text-sm"
      >
        <Plus className="h-3 w-3 @3xl:h-4 @3xl:w-4" /> Create a Virtual Place
      </Link>
      <Link href={PLACES_HREF} className="text-[0.6rem] font-medium text-teal-deep hover:underline @3xl:text-sm">
        All Virtual Places →
      </Link>
    </section>
  )
}

function RoomSquare({ space, count }: { space: VirtualSpace; count: number | null }) {
  const router = useRouter()
  const session = useRoomSession()
  const inside = session.space?.id === space.id && (session.phase === 'in-room' || session.phase === 'reconnecting')
  const label = inside ? `Return to ${space.name}` : `Go to ${space.name}`

  return (
    <button
      onClick={() =>
        space.isActive && (openToGuests(space) ? router.push(roomHref(space.slug, true)) : withAuth(() => router.push(roomHref(space.slug, true)), `Join PLACES FOR US to enter ${space.name}.`))
      }
      disabled={!space.isActive}
      aria-label={space.isActive ? label : `${space.name} is closed`}
      className="group relative isolate flex aspect-square w-full flex-col justify-end overflow-hidden rounded-card text-left shadow-soft ring-1 ring-navy/5 transition duration-500 ease-gentle enabled:hover:-translate-y-0.5 enabled:hover:shadow-lift disabled:cursor-default"
    >
      <RoomBackdrop space={space} dim={false} fit="cover" className={cn('-z-10 transition duration-700 ease-gentle', space.isActive ? 'group-hover:scale-[1.04]' : 'grayscale-[0.6]')} />
      <span className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_20%,rgb(18_59_74/0.78)_100%)]" />
      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-teal-deep @3xl:left-3 @3xl:top-3 @3xl:text-[0.6rem]">
        {space.isActive ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-teal" /> Live
          </>
        ) : (
          'Closed'
        )}
      </span>
      <span className="p-2.5 text-white @3xl:p-4">
        <span className="block font-serif text-[0.95rem] leading-tight @3xl:text-2xl">{space.name}</span>
        {space.isActive && count != null && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[0.55rem] text-white/85 @3xl:text-xs" data-testid="space-count">
            <Users className="h-2.5 w-2.5 @3xl:h-3 @3xl:w-3" /> {count}
          </span>
        )}
        {space.isActive && (
          <span className="mt-1 hidden items-center gap-1 text-sm font-semibold @3xl:flex">
            {inside ? 'Return' : 'Go in'} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </span>
    </button>
  )
}
