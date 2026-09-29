import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PricingPage } from '@/components/pricing/PricingPage'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'PLACES is free to join and explore. PLACES Pass is $21/month: publish courses with 0% PLACES fees, host virtual spaces and post opportunities.',
}

export default function Page() {
  return (
    <Suspense>
      <PricingPage />
    </Suspense>
  )
}
