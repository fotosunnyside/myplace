'use client'

import { ArrowRight } from 'lucide-react'
import { useMe } from '@/lib/store/hooks'
import { openAuth } from '@/lib/ui'

/** "Enter PLACES": guests join, members fly down to the world. */
export function EnterCta() {
  const me = useMe()
  return (
    <a
      href="#world"
      onClick={(e) => {
        if (me) return
        e.preventDefault()
        openAuth({ mode: 'join', onDone: () => document.getElementById('world')?.scrollIntoView({ behavior: 'smooth' }) })
      }}
      className="group inline-flex h-[var(--hero-cta)] items-center gap-3 rounded-full bg-teal px-[1.9em] text-[length:var(--hero-value)] font-medium text-white shadow-[0_14px_30px_-12px_rgb(18_170_168/0.85)] transition duration-300 ease-gentle hover:bg-teal-deep hover:shadow-[0_18px_36px_-12px_rgb(18_170_168/0.9)] active:scale-[0.98]"
    >
      Enter PLACES
      <ArrowRight className="h-[1.1em] w-[1.1em] transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  )
}
