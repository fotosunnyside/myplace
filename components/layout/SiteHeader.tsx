'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { SearchField } from '@/components/search/SearchField'
import { Avatar } from '@/components/ui/primitives'
import { currentUser } from '@/lib/data/identity'
import { cn } from '@/lib/cn'

export const primaryNav = [
  { label: 'Explore', href: '/explore' },
  { label: 'Communities', href: '/mindplace' },
  { label: 'Opportunities', href: '/workplace' },
  { label: 'Messages', href: '/messages' },
]

/** Floating, translucent desktop/tablet header. Transparent over the home world until scrolled. */
export function SiteHeader() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const { profile } = currentUser

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 hidden transition-[background-color,box-shadow,backdrop-filter] duration-500 ease-gentle md:block',
        scrolled || pathname !== '/'
          ? 'bg-cream/80 shadow-[0_1px_0_rgb(18_59_74/0.06),0_10px_30px_-20px_rgb(18_59_74/0.35)] backdrop-blur-xl'
          : 'bg-gradient-to-b from-cream/85 via-cream/50 to-transparent',
      )}
    >
      <div className="mx-auto flex h-[76px] max-w-[1600px] items-center gap-6 px-6 lg:px-10">
        <Logo />

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 lg:ml-[6vw] lg:flex xl:ml-[9vw]">
          {primaryNav.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-full px-4 py-2 text-[0.92rem] font-medium text-navy transition-colors hover:bg-navy/[0.04]',
                  active && 'text-teal-deep',
                )}
              >
                {item.label}
                {active && <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-teal" />}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:gap-5">
          <SearchField placeholder="Search people, places, products..." className="w-[clamp(220px,24vw,360px)]" />
          <button
            aria-label="Notifications, 1 new"
            className="relative grid h-10 w-10 place-items-center rounded-full text-navy transition hover:bg-navy/5"
          >
            <Bell className="h-[22px] w-[22px]" strokeWidth={1.6} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-coral ring-2 ring-cream" />
          </button>
          <Link href="/yourplace" aria-label={`${profile.name}'s profile`} className="rounded-full">
            <Avatar src={profile.avatar} alt="" size={46} ring />
          </Link>
        </div>
      </div>
    </header>
  )
}
