'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass, House, MessageSquare, Plus, Search, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { DistrictIcon } from '@/components/districts/DistrictIcon'
import { Avatar } from '@/components/ui/primitives'
import { currentUser } from '@/lib/data/identity'
import { orderedDistricts } from '@/lib/world/districts'
import { cn } from '@/lib/cn'

/* ------------------------------------------------------------------ */
/* Top bar — search · centered logo · avatar                            */
/* ------------------------------------------------------------------ */

export function MobileTopBar() {
  return (
    <header className="pt-safe fixed inset-x-0 top-0 z-40 bg-cream/85 backdrop-blur-xl md:hidden">
      <div className="grid h-[64px] grid-cols-[48px_1fr_48px] items-center px-4">
        <Link href="/explore" aria-label="Search" className="grid h-10 w-10 place-items-center rounded-full text-teal-deep active:bg-navy/5">
          <Search className="h-[22px] w-[22px]" strokeWidth={1.8} />
        </Link>
        <Logo variant="stacked" className="justify-self-center" />
        <Link href="/yourplace" aria-label="Your profile" className="justify-self-end">
          <Avatar src={currentUser.profile.avatar} alt="" size={38} ring />
        </Link>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Bottom tab bar                                                       */
/* ------------------------------------------------------------------ */

const tabs = [
  { label: 'Home', href: '/', icon: House },
  { label: 'Explore', href: '/explore', icon: Compass },
  { label: 'Create', href: '#create', icon: Plus },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Profile', href: '/yourplace', icon: UserRound },
]

export function MobileTabBar() {
  const pathname = usePathname()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <nav
        aria-label="Tabs"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-cream/90 backdrop-blur-xl md:hidden"
      >
        <ul className="grid h-[62px] grid-cols-5">
          {tabs.map(({ label, href, icon: Icon }) => {
            if (href === '#create') {
              return (
                <li key={label} className="flex justify-center">
                  <button
                    onClick={() => setCreating(true)}
                    aria-haspopup="dialog"
                    className="flex flex-col items-center gap-0.5 pt-1 text-[0.65rem] font-medium text-teal-deep"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-teal text-white shadow-[0_8px_18px_-6px_rgb(18_170_168/0.8)] transition active:scale-95">
                      <Plus className="h-6 w-6" strokeWidth={2.2} />
                    </span>
                    {label}
                  </button>
                </li>
              )
            }
            const active = pathname === href
            return (
              <li key={label}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-full flex-col items-center justify-center gap-1 text-[0.65rem] font-medium transition-colors',
                    active ? 'text-teal-deep' : 'text-navy-soft',
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.1 : 1.7} fill={active && label === 'Home' ? 'currentColor' : 'none'} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <CreateSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Create sheet — one identity, create anywhere                          */
/* ------------------------------------------------------------------ */

const createActions: Record<string, string> = {
  yourplace: 'Share a post',
  mindplace: 'Start a discussion',
  marketplace: 'List a product',
  workplace: 'Post an opportunity',
}

export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-navy/25 backdrop-blur-[2px]" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Create"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="pb-safe absolute inset-x-0 bottom-0 rounded-t-[28px] bg-cream px-5 pt-3 shadow-lift md:inset-x-auto md:bottom-8 md:left-1/2 md:w-[420px] md:-translate-x-1/2 md:rounded-[28px] md:pb-5"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line md:hidden" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-2xl">Create in PLACES</h2>
              <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-navy/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mb-4 grid gap-2">
              {orderedDistricts().map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.href}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-2xl border border-line/80 bg-white/80 p-3 transition hover:border-teal/30 hover:bg-white"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
                      <DistrictIcon icon={d.icon} className="h-5 w-5" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{createActions[d.id]}</span>
                      <span className="text-xs text-muted">in {d.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
