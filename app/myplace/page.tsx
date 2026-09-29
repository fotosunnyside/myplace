import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Redirect } from '@/components/spaces/Redirect'
import { PLACES_HREF } from '@/lib/spaces/rooms'

export const metadata: Metadata = { title: 'Virtual Places', robots: { index: false } }

/** MyPlace is now part of YourPlace: its Virtual Places live in a YourPlace tab. */
export default function Page() {
  return (
    <Suspense>
      <Redirect to={PLACES_HREF} />
    </Suspense>
  )
}
