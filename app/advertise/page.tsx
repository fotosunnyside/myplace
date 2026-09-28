import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdvertisePage } from '@/components/ads/AdvertisePage'

export const metadata: Metadata = { title: 'Advertise' }

export default function Page() {
  return (
    <Suspense>
      <AdvertisePage />
    </Suspense>
  )
}
