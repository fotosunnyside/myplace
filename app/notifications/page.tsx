import type { Metadata } from 'next'
import { Suspense } from 'react'
import { NotificationsPage } from '@/components/detail/pages'

export const metadata: Metadata = { title: 'Notifications' }

export default function Page() {
  return (
    <Suspense>
      <NotificationsPage />
    </Suspense>
  )
}
