import type { Metadata } from 'next'
import { AdminHome } from '@/components/admin/AdminPages'

export const metadata: Metadata = { title: 'Admin', robots: { index: false } }

export default function Page() {
  return <AdminHome />
}
