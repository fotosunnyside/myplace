import Link from 'next/link'
import { ButtonLink } from '@/components/ui/primitives'

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[80dvh] max-w-xl place-items-center px-6 pt-24 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-deep">Off the map</p>
        <h1 className="mt-3 font-serif text-5xl leading-tight">This path doesn’t lead anywhere — yet.</h1>
        <p className="mt-4 text-navy-soft">The page you were looking for isn’t part of the world. Let’s get you back somewhere lovely.</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/" size="lg" className="!text-base">
            Back to the world
          </ButtonLink>
          <Link href="/explore" className="inline-flex h-14 items-center px-4 font-medium text-teal-deep hover:underline">
            Explore
          </Link>
        </div>
      </div>
    </main>
  )
}
