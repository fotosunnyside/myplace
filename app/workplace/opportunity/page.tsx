import type { Metadata } from 'next'
import { Suspense } from 'react'
import { OpportunityDetail } from '@/components/detail/OpportunityDetail'

export const metadata: Metadata = { title: 'Opportunity' }

export default function Page() {
  return (
    <Suspense>
      <OpportunityDetail />
    </Suspense>
  )
}
