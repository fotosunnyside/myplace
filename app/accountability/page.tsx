import type { Metadata } from 'next'
import { GoToRoom } from '@/components/spaces/GoToRoom'

export const metadata: Metadata = {
  title: 'Accountability Department',
  description: 'Bring something you need to finish. Camera on. Work quietly alongside other people and get it done. Free — just add your name.',
}

/** A short link to share (e.g. in a Skool community): straight to the Accountability Department's door. */
export default function Page() {
  return <GoToRoom slug="accountability-room" />
}
