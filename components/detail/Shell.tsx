'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useHydrated } from '@/lib/store/hooks'
import { cn } from '@/lib/cn'

/** Page frame that clears the fixed header / tab bar. */
export function Shell({ children, back, width = 'max-w-5xl', className }: { children: ReactNode; back?: { href: string; label: string }; width?: string; className?: string }) {
  return (
    <main className={cn('mx-auto px-4 pb-[calc(100px+env(safe-area-inset-bottom))] pt-[calc(76px+env(safe-area-inset-top))] md:px-8 md:pb-20 md:pt-[104px]', width, className)}>
      {back && (
        <Link href={back.href} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-teal-deep hover:underline">
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      {children}
    </main>
  )
}

/** Shown when an item id doesn't exist (yet — the device may still be loading). */
export function NotFoundHere({ what, href, label }: { what: string; href: string; label: string }) {
  const ready = useHydrated()
  if (!ready) return <div className="h-64 animate-pulse rounded-panel bg-white/50" aria-busy="true" aria-label="Loading" />
  return (
    <div className="rounded-panel bg-white/70 px-6 py-16 text-center">
      <p className="font-serif text-3xl">We couldn’t find that {what}.</p>
      <p className="mt-2 text-muted">It may have been removed.</p>
      <Link href={href} className="mt-6 inline-block font-medium text-teal-deep hover:underline">
        {label}
      </Link>
    </div>
  )
}
