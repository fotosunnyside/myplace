import type { Metadata } from 'next'
import { MyPlacePage } from '@/components/spaces/MyPlacePage'

export const metadata: Metadata = { title: 'Virtual Spaces', description: 'Live rooms in PLACES: Town Hall, the Accountability Department, and spaces members host.' }

export default function Page() {
  return <MyPlacePage />
}
