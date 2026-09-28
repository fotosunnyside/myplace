import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CourseEditor } from '@/components/detail/CourseEditor'

export const metadata: Metadata = { title: 'Course editor' }

export default function Page() {
  return (
    <Suspense>
      <CourseEditor />
    </Suspense>
  )
}
