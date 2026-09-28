import type { Metadata } from 'next'
import { AdminSpaces } from '@/components/admin/AdminPages'

export const metadata: Metadata = { title: 'Virtual Spaces · Admin', robots: { index: false } }

export default function Page() {
  return <AdminSpaces />
}
