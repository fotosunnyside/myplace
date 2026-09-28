import type { Metadata } from 'next'
import { Suspense } from 'react'
import { VirtualSpacePage } from '@/components/spaces/VirtualSpaceRoom'

export const metadata: Metadata = { title: 'Live space' }

export default function Page() {
  return (
    <Suspense>
      <VirtualSpacePage />
    </Suspense>
  )
}
