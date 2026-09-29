'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Old addresses keep working: sends people on to where that page lives now, carrying the query along
 * (e.g. /myplace/space/?room=town-hall → /yourplace/place/?room=town-hall).
 */
export function Redirect({ to, keepQuery = true }: { to: string; keepQuery?: boolean }) {
  const router = useRouter()
  const query = useSearchParams().toString()
  useEffect(() => {
    const [path, own = ''] = to.split('?')
    const params = new URLSearchParams(own)
    if (keepQuery) new URLSearchParams(query).forEach((v, k) => params.set(k, v))
    const q = params.toString()
    router.replace(q ? `${path}?${q}` : path)
  }, [router, to, query, keepQuery])
  return <main className="grid min-h-dvh place-items-center text-navy-soft">Taking you there…</main>
}
