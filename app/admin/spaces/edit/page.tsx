import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SpaceEditorPage } from '@/components/admin/SpaceEditor'

export const metadata: Metadata = { title: 'Edit room · Admin', robots: { index: false } }

export default function Page() {
  return (
    <Suspense>
      <SpaceEditorPage />
    </Suspense>
  )
}
