'use client'

import { useSearchParams } from 'next/navigation'

export function SearchNotice() {
  const q = useSearchParams().get('q')
  if (!q) return null
  return (
    <p className="mt-4 text-sm text-navy-soft">
      Search is coming soon. Showing every Place for “<span className="font-medium text-navy">{q}</span>”.
    </p>
  )
}
