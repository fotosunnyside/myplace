import type { Metadata } from 'next'
import { AdminMusic } from '@/components/admin/MusicLibrary'

export const metadata: Metadata = { title: 'Room music · Admin', robots: { index: false } }

export default function Page() {
  return <AdminMusic />
}
