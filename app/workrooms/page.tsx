import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WorkroomsPage } from '@/components/detail/Workrooms'

export const metadata: Metadata = { title: 'Workrooms' }

export default function Page() {
  return (
    <Suspense>
      <WorkroomsPage />
    </Suspense>
  )
}
