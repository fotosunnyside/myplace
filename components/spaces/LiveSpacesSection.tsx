'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { featuredSpaces } from '@/lib/spaces/rooms'
import { useOccupancy, useSpaces } from '@/lib/spaces/store'
import { cn } from '@/lib/cn'
import { SpaceCard } from './SpaceCard'

/** The rooms PLACES keeps open for everyone, on YourPlace and MyPlace. */
export function LiveSpacesSection({ className, heading = 'Live Spaces', showAll = true }: { className?: string; heading?: string; showAll?: boolean }) {
  const spaces = useSpaces()
  const occupancy = useOccupancy()
  const list = spaces.status === 'ready' ? featuredSpaces(spaces.data) : 'data' in spaces && spaces.data ? featuredSpaces(spaces.data) : []

  return (
    <section aria-labelledby="live-spaces" className={cn('px-4 @3xl:px-0', className)}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-teal-deep">Happening now</p>
          <h2 id="live-spaces" className="mt-1 font-serif text-[1.9rem] leading-tight @3xl:text-[2.3rem]">
            {heading}
          </h2>
        </div>
        {showAll && (
          <Link href="/myplace" className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal-deep hover:text-teal">
            In MyPlace <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {spaces.status === 'loading' ? (
        <div className="grid gap-4 @2xl:grid-cols-2" aria-busy="true" aria-label="Loading live spaces">
          {[0, 1].map((i) => (
            <div key={i} className="min-h-[300px] animate-pulse rounded-panel bg-white/60 md:min-h-[340px]" />
          ))}
        </div>
      ) : list.length ? (
        <div className="grid gap-4 @2xl:grid-cols-2">
          {list.map((s) => (
            <SpaceCard key={s.id} space={s} count={occupancy ? (occupancy[s.id] ?? 0) : null} />
          ))}
        </div>
      ) : (
        <p className="rounded-panel bg-white/70 px-6 py-10 text-center text-sm text-muted">
          {spaces.status === 'error' ? 'Live spaces are out of reach right now. Try again in a moment.' : 'No live spaces are open right now.'}
        </p>
      )}
    </section>
  )
}
