import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { DistrictId } from '@/lib/types'
import { orderedDistricts } from '@/lib/world/districts'
import { cn } from '@/lib/cn'

/** "Continue in YourPlace"-style cards that carry you between Places. */
export function PlaceCards({ exclude, className }: { exclude?: DistrictId; className?: string }) {
  const list = orderedDistricts().filter((d) => d.id !== exclude)
  return (
    <ul className={cn('grid gap-3 sm:grid-cols-2 lg:gap-4', exclude ? 'lg:grid-cols-3' : 'lg:grid-cols-4', className)}>
      {list.map((d) => (
        <li key={d.id}>
          <Link
            href={d.href}
            className="group block overflow-hidden rounded-card border border-white/80 bg-white/85 shadow-soft transition duration-500 ease-gentle hover:-translate-y-1 hover:shadow-lift"
          >
            <div className="relative aspect-[288/77] overflow-hidden">
              <Image src={d.art.card} alt="" fill sizes="(min-width: 1024px) 25vw, 100vw" className="object-cover transition duration-700 ease-gentle group-hover:scale-105" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-lg leading-tight text-navy">
                  {d.teaser.verb} {d.name}
                </p>
                <p className="truncate text-xs text-muted">{d.teaser.line}</p>
              </div>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ivory text-navy transition group-hover:bg-teal group-hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
