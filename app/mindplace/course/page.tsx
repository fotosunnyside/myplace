import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CourseDetail } from '@/components/detail/CourseDetail'

export const metadata: Metadata = { title: 'Course' }

export default function Page() {
  return (
    <Suspense>
      <CourseDetail />
    </Suspense>
  )
}
