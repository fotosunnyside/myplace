import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ShopDetail } from '@/components/detail/ShopDetail'

export const metadata: Metadata = { title: 'Shop' }

export default function Page() {
  return (
    <Suspense>
      <ShopDetail />
    </Suspense>
  )
}
