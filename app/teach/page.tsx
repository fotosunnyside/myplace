import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TeachPage } from '@/components/detail/TeachPage'

export const metadata: Metadata = { title: 'Teach on PLACES', description: 'Host your courses in MindPlace for $2/month — free or paid, you keep every sale.' }

export default function Page() {
  return (
    <Suspense>
      <TeachPage />
    </Suspense>
  )
}
