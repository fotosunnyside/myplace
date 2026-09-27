import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { DistrictConfig } from '@/lib/world/districts'
import { DISTRICT_APPS } from './apps'
import { DistrictBanner } from './DistrictBanner'

/** A "window" into a district: illustrated banner over a live, miniature version of its interface. */
export function DistrictPreviewPanel({ district }: { district: DistrictConfig }) {
  const App = DISTRICT_APPS[district.id]
  return (
    <article className="group/panel relative flex h-[560px] flex-col overflow-hidden rounded-panel border border-white/80 bg-cream shadow-soft transition duration-500 ease-gentle hover:-translate-y-1 hover:shadow-lift">
      <Link href={district.href} aria-label={`Open ${district.name}`} className="block overflow-hidden">
        <DistrictBanner district={district} className="transition duration-700 ease-gentle group-hover/panel:scale-[1.015]" />
      </Link>
      <div className="relative -mt-3 min-h-0 flex-1 overflow-hidden rounded-t-[20px] bg-cream @container">
        <App compact />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cream via-cream/90 to-transparent" />
      </div>
      <Link
        href={district.href}
        className="absolute inset-x-4 bottom-4 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/90 text-sm font-medium text-teal-deep shadow-soft backdrop-blur transition hover:bg-teal hover:text-white"
      >
        Enter {district.name}
        <ArrowRight className="h-4 w-4 transition-transform group-hover/panel:translate-x-0.5" />
      </Link>
    </article>
  )
}
