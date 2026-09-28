import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WorkroomPage } from '@/components/detail/Workrooms'

export const metadata: Metadata = { title: 'Workroom' }

export default function Page() {
  return (
    <Suspense>
      <WorkroomPage />
    </Suspense>
  )
}
