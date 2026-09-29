import { Hammer, LineChart, Lightbulb, ScanFace, Store } from 'lucide-react'
import { PlacesWorld } from '@/components/world/PlacesWorld'
import { EnterCta } from './EnterCta'

const values = [
  { label: 'Make your place.', icon: LineChart },
  { label: 'Learn something.', icon: Lightbulb },
  { label: 'Build something.', icon: Hammer },
  { label: 'Find work.', icon: Store },
  { label: 'Discover people.', icon: ScanFace },
]

function Headline({ className = '' }: { className?: string }) {
  return (
    // The logo above already says PLACES FOR US, so the tagline leads (the name stays for screen readers and search).
    <h1 className={`font-serif text-navy ${className}`}>
      <span className="sr-only">PLACES FOR US: </span>
      <span className="block text-[length:var(--hero-sub)] leading-[1.08] tracking-[-0.01em]">
        The internet,
        <br />
        made into a world.
      </span>
    </h1>
  )
}

function Values({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-col gap-[var(--hero-gap)] ${className}`}>
      {values.map(({ label, icon: Icon }) => (
        <li key={label} className="flex items-center gap-4 text-[length:var(--hero-value)] text-navy">
          <Icon className="h-[1.3em] w-[1.3em] shrink-0 text-teal" strokeWidth={1.4} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  )
}

function Community({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-center font-serif text-[length:var(--hero-note)] leading-snug text-navy-soft">
        A global community to live,
        <br />
        learn, create and work — together.
      </p>
      <p className="mt-[1.4em] flex items-center justify-center gap-3 text-[0.62rem] font-medium uppercase tracking-[0.34em] text-muted">
        <span className="h-px w-10 bg-muted/40" />
        The Conscious Web
        <span className="h-px w-10 bg-muted/40" />
      </p>
    </div>
  )
}

const heroVars = [
  '[--hero-sub:2.4rem] lg:[--hero-sub:clamp(1.9rem,3vw,3.7rem)]',
  '[--hero-value:1rem] lg:[--hero-value:clamp(0.82rem,1.12vw,1.3rem)]',
  '[--hero-note:0.95rem] lg:[--hero-note:clamp(0.78rem,1.02vw,1.15rem)]',
  '[--hero-gap:0.55rem] lg:[--hero-gap:clamp(0.4rem,0.72vw,0.95rem)]',
  '[--hero-cta:3.1rem] lg:[--hero-cta:clamp(2.5rem,3.3vw,3.7rem)]',
].join(' ')

/**
 * Desktop (lg+): editorial column (~29%) beside the world (~75%), the world bleeding under the header.
 * Tablet (md): a compact editorial band above a full-width world, so the world stays dominant.
 * Phones get <MobileHome /> instead.
 */
export function HomeHero() {
  return (
    <section aria-label="Welcome to PLACES FOR US" className={`relative hidden bg-cream md:block ${heroVars}`}>
      <div className="grid grid-cols-[1.1fr_1fr] items-end gap-8 px-8 pb-6 pt-[108px] lg:absolute lg:inset-y-0 lg:left-0 lg:z-10 lg:flex lg:w-[29%] lg:flex-col lg:items-stretch lg:justify-center lg:gap-0 lg:pb-[1vw] lg:pl-[3.2vw] lg:pr-[1vw] lg:pt-[84px]">
        <Headline />
        <div className="flex flex-col items-start gap-5 lg:contents">
          <Values className="lg:mt-[2.2vw]" />
          <div className="lg:mt-[2.4vw]">
            <EnterCta />
          </div>
        </div>
        <Community className="hidden max-w-[22rem] lg:mt-[2.2vw] lg:block" />
      </div>

      <div id="world" className="relative scroll-mt-20 lg:ml-auto lg:w-[75%]">
        <PlacesWorld sizes="(min-width: 1024px) 75vw, 100vw" />
        {/* soft hand-off from the editorial column into the world */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-[16%] bg-gradient-to-r from-cream via-cream/70 to-transparent lg:block" />
      </div>

      <Community className="py-6 lg:hidden" />
    </section>
  )
}
