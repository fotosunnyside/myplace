import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MessagesView } from '@/components/detail/MessagesView'

export const metadata: Metadata = { title: 'Messages' }

export default function Page() {
  return (
    <Suspense>
      <MessagesView />
    </Suspense>
  )
}
