import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TeachPage } from '@/components/detail/TeachPage'

export const metadata: Metadata = { title: 'Teach on PLACES', description: 'Publish a course or membership in MindPlace — free, one-time or monthly. $7/month per course, or included with PLACES Pass.' }

export default function Page() {
  return (
    <Suspense>
      <TeachPage />
    </Suspense>
  )
}
