'use client'

import Link from 'next/link'
import { ArrowUpRight, Megaphone } from 'lucide-react'
import { Picture } from '@/components/ui/Picture'
import { activeAd } from '@/lib/store/actions'
import { useNow, useWorld } from '@/lib/store/hooks'
import { formatPrice } from '@/lib/store/selectors'
import { ADS } from '@/lib/config'
import type { Ad, DistrictId } from '@/lib/types'
import { cn } from '@/lib/cn'

/** The single sponsored mini banner shown in each Place. */
export function AdSlot({ district, className }: { district: DistrictId; className?: string }) {
  const world = useWorld()
  const now = useNow()
  const ad = activeAd(world, district, now)
  return ad ? <AdCard ad={ad} className={className} /> : <HouseAd district={district} className={className} />
}

export function AdCard({ ad, className, preview }: { ad: Pick<Ad, 'business' | 'headline' | 'image' | 'url'>; className?: string; preview?: boolean }) {
  return (
    <a
      href={preview ? undefined : ad.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      aria-label={`Sponsored: ${ad.business} — ${ad.headline}`}
      className={cn('group flex min-w-0 items-center gap-4 rounded-card border border-line/70 bg-white/80 p-2.5 pr-4 shadow-soft transition hover:shadow-lift', className)}
    >
      <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-sand md:h-16 md:w-24">{ad.image && <Picture src={ad.image} alt="" fill sizes="96px" className="object-cover" />}</span>
      <span className="min-w-0 flex-1">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted">Sponsored · {ad.business || 'Your business'}</span>
        <span className="block truncate font-medium text-navy">{ad.headline || 'Your headline here'}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-teal-deep sm:inline-flex">
        Visit <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </a>
  )
}

function HouseAd({ district, className }: { district: DistrictId; className?: string }) {
  return (
    <Link
      href={`/advertise/?place=${district}`}
      className={cn('group flex items-center gap-4 rounded-card border border-dashed border-teal/30 bg-teal-wash/30 p-3 pr-4 transition hover:bg-teal-wash/60', className)}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-teal-deep">
        <Megaphone className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted">Sponsored spot available</span>
        <span className="block truncate text-sm text-navy">Put your business here — one gentle banner per Place, from {formatPrice(ADS.week.price)}/week.</span>
      </span>
      <span className="hidden shrink-0 text-sm font-medium text-teal-deep sm:inline">Advertise →</span>
    </Link>
  )
}
