import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ActivityPage } from '@/components/detail/pages'

export const metadata: Metadata = { title: 'Activity' }

export default function Page() {
  return (
    <Suspense>
      <ActivityPage />
    </Suspense>
  )
}
