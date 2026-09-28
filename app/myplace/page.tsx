import type { Metadata } from 'next'
import { MyPlacePage } from '@/components/spaces/MyPlacePage'

export const metadata: Metadata = { title: 'MyPlace', description: 'Your corner of PLACES, and home of its live spaces: Town Hall and the Accountability Room.' }

export default function Page() {
  return <MyPlacePage />
}
