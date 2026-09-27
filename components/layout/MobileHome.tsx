import { MobileWorld } from '@/components/world/MobileWorld'
import { PlaceCards } from '@/components/districts/PlaceCards'
import { currentUser } from '@/lib/data/identity'

/** Phone home: the vertical world first, then gentle ways back into each Place. */
export function MobileHome() {
  return (
    <div className="pb-[calc(86px+env(safe-area-inset-bottom))] pt-[calc(64px+env(safe-area-inset-top))] md:hidden">
      <h1 className="sr-only">PLACES — The internet, made into a world.</h1>
      <MobileWorld />
      <section className="px-4 pt-7">
        <p className="font-serif text-[1.7rem] leading-tight text-navy">
          Good afternoon, <span className="italic">{currentUser.profile.name}</span>
        </p>
        <p className="mt-1 font-serif text-[0.95rem] italic text-navy-soft">
          A global community to live, learn, create and work — together.
        </p>
        <PlaceCards className="mt-5" />
        <p className="mt-8 flex items-center justify-center gap-3 text-[0.6rem] font-medium uppercase tracking-[0.34em] text-muted">
          <span className="h-px w-8 bg-muted/40" />
          The Conscious Web
          <span className="h-px w-8 bg-muted/40" />
        </p>
      </section>
    </div>
  )
}
