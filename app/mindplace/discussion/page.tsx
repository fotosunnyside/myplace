import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DiscussionDetail } from '@/components/detail/DiscussionDetail'

export const metadata: Metadata = { title: 'Discussion' }

export default function Page() {
  return (
    <Suspense>
      <DiscussionDetail />
    </Suspense>
  )
}
