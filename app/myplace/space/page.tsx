import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Redirect } from '@/components/spaces/Redirect'
import { ROOM_PATH } from '@/lib/spaces/rooms'

export const metadata: Metadata = { title: 'Virtual Place', robots: { index: false } }

/** MyPlace is now part of YourPlace: old room links go to the room's new address. */
export default function Page() {
  return (
    <Suspense>
      <Redirect to={`${ROOM_PATH}/`} />
    </Suspense>
  )
}
