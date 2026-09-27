import type { Metadata } from 'next'
import { DistrictPreviewPanel } from '@/components/districts/DistrictPreviewPanel'
import { PlaceCards } from '@/components/districts/PlaceCards'
import { SearchField } from '@/components/search/SearchField'
import { orderedDistricts } from '@/lib/world/districts'

export const metadata: Metadata = { title: 'Explore', description: 'Explore every Place in PLACES.' }

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  return (
    <main className="mx-auto max-w-[1800px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(80px+env(safe-area-inset-top))] md:px-8 md:pb-20 md:pt-[108px]">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.34em] text-teal-deep">Explore</p>
        <h1 className="mt-3 font-serif text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[1.05]">Where would you like to go?</h1>
        <SearchField placeholder="Search people, places, products, jobs, or topics..." size="lg" className="mt-6" />
        {q && (
          <p className="mt-4 text-sm text-navy-soft">
            Search is coming soon. Showing every Place for “<span className="font-medium text-navy">{q}</span>”.
          </p>
        )}
      </header>

      <PlaceCards className="mt-10 md:hidden" />

      <div className="mt-12 hidden grid-cols-2 gap-5 md:grid xl:grid-cols-4">
        {orderedDistricts().map((d) => (
          <DistrictPreviewPanel key={d.id} district={d} />
        ))}
      </div>
    </main>
  )
}
