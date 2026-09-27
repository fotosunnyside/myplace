import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PeoplePage } from '@/components/detail/pages'

export const metadata: Metadata = { title: 'Profile' }

export default function Page() {
  return (
    <Suspense>
      <PeoplePage />
    </Suspense>
  )
}
