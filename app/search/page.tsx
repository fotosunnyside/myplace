import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchPage } from '@/components/detail/pages'

export const metadata: Metadata = { title: 'Search' }

export default function Page() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  )
}
