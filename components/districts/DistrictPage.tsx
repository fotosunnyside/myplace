'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { DistrictId } from '@/lib/types'
import { getDistrict } from '@/lib/world/districts'
import { SearchField } from '@/components/search/SearchField'
import { AdSlot } from '@/components/ads/AdSlot'
import { DISTRICT_APPS } from './apps'
import { DistrictBanner } from './DistrictBanner'
import { PlaceCards } from './PlaceCards'

const searchPlaceholders: Partial<Record<DistrictId, string>> = {
  mindplace: 'Search topics, courses, or people...',
  marketplace: 'Search products, services, or shops...',
  workplace: 'Search jobs, services, or people...',
}

/** Full-page district: arrives from the world with a gentle settle, then the interface rises in. */
export function DistrictPage({ id }: { id: DistrictId }) {
  const district = getDistrict(id)
  const App = DISTRICT_APPS[id]
  const reduce = useReducedMotion()
  const placeholder = searchPlaceholders[id]

  return (
    <main className="min-h-dvh pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(72px+env(safe-area-inset-top))] md:pb-20 md:pt-[92px]">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 1.06, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-panel shadow-soft"
        >
          <DistrictBanner district={district} priority asHeading sizes="(min-width: 1152px) 1152px, 100vw" />
        </motion.div>

        {placeholder && (
          <div className="relative z-10 mx-auto -mt-7 hidden w-[min(680px,86%)] md:block">
            <SearchField placeholder={placeholder} size="lg" className="shadow-lift [&_input]:h-14 [&_input]:bg-white" />
          </div>
        )}

        {/* YourPlace keeps its sponsored spot at the bottom (and one in the feed); the other Places show it up top. */}
        {id !== 'yourplace' && <AdSlot district={id} className="mt-5 md:mt-10" />}

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="@container -mx-4 md:mx-0"
        >
          <App />
        </motion.div>

        {id === 'yourplace' && <AdSlot district={id} className="mt-8 md:mt-12" />}

        <section className="mt-12 md:mt-16">
          <p className="mb-4 text-center text-[0.7rem] font-medium uppercase tracking-[0.32em] text-muted">Keep exploring</p>
          <PlaceCards exclude={id} />
        </section>
      </div>
    </main>
  )
}
