import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ProductDetail } from '@/components/detail/ProductDetail'

export const metadata: Metadata = { title: 'Product' }

export default function Page() {
  return (
    <Suspense>
      <ProductDetail />
    </Suspense>
  )
}
