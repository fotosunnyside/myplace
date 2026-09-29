'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { roomHref } from '@/lib/spaces/rooms'

/** Sends a short, shareable link on to a room's door. */
export function GoToRoom({ slug }: { slug: string }) {
  const router = useRouter()
  useEffect(() => router.replace(roomHref(slug, true)), [router, slug])
  return <main className="grid min-h-dvh place-items-center text-navy-soft">Opening the room…</main>
}
