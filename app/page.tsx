import { HomeHero } from '@/components/layout/HomeHero'
import { MobileHome } from '@/components/layout/MobileHome'
import { DistrictPreviewPanel } from '@/components/districts/DistrictPreviewPanel'
import { orderedDistricts } from '@/lib/world/districts'

export default function HomePage() {
  return (
    <main>
      <MobileHome />
      <HomeHero />

      <section aria-labelledby="places-heading" className="relative hidden bg-ivory px-6 pb-16 pt-4 md:block lg:px-[1.4vw] lg:pt-[1.2vw]">
        <h2 id="places-heading" className="sr-only">
          The four Places
        </h2>
        <div className="mx-auto grid max-w-[1800px] grid-cols-2 gap-5 xl:grid-cols-4 xl:gap-[1vw]">
          {orderedDistricts().map((d) => (
            <DistrictPreviewPanel key={d.id} district={d} />
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-3xl text-center">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.34em] text-teal-deep">One connected world</p>
          <p className="mt-4 font-serif text-[clamp(1.8rem,3vw,2.8rem)] leading-tight text-navy">
            One person. One identity.
            <br />
            Four Places.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-navy-soft">
            Your profile, reputation and saved things travel with you — from your home in YourPlace to the courses in MindPlace, the shops of
            MarketPlace and the teams of WorkPlace.
          </p>
        </div>
      </section>
    </main>
  )
}
