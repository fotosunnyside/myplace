'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Compass, House, MessageSquare, Plus, Search, UserRound } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/primitives'
import { useHydrated, useWorld } from '@/lib/store/hooks'
import { me, unreadNotifications, unreadThreads } from '@/lib/store/selectors'
import { openAuth, openCreate } from '@/lib/ui'
import { cn } from '@/lib/cn'

/* ------------------------------------------------------------------ */
/* Top bar — search · centered logo · avatar                            */
/* ------------------------------------------------------------------ */

export function MobileTopBar() {
  const world = useWorld()
  const ready = useHydrated()
  const account = me(world)
  const unread = unreadNotifications(world)

  return (
    <header className="pt-safe fixed inset-x-0 top-0 z-40 bg-cream/85 backdrop-blur-xl md:hidden">
      <div className="grid h-[64px] grid-cols-[88px_1fr_88px] items-center px-3">
        <div className="flex items-center">
          <Link href="/search" aria-label="Search" className="grid h-10 w-10 place-items-center rounded-full text-teal-deep active:bg-navy/5">
            <Search className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </Link>
          {account && (
            <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} new` : ''}`} className="relative grid h-10 w-10 place-items-center rounded-full text-teal-deep active:bg-navy/5">
              <Bell className="h-[21px] w-[21px]" strokeWidth={1.8} />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-cream" />}
            </Link>
          )}
        </div>
        <Logo variant="stacked" className="justify-self-center" />
        <div className="justify-self-end">
          {!ready ? (
            <span className="block h-[38px] w-[38px]" />
          ) : account ? (
            <Link href="/yourplace" aria-label="Your profile">
              <Avatar src={account.avatar} alt="" name={account.name} size={38} ring />
            </Link>
          ) : (
            <button onClick={() => openAuth({ mode: 'join' })} className="h-9 rounded-full bg-teal px-4 text-sm font-medium text-white">
              Join
            </button>
          )}
        </div>
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
  const pathname = usePathname().replace(/\/$/, '') || '/'
  const unreadMsgs = unreadThreads(useWorld())

  return (
    <nav aria-label="Tabs" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-cream/90 backdrop-blur-xl md:hidden">
      <ul className="grid h-[62px] grid-cols-5">
        {tabs.map(({ label, href, icon: Icon }) => {
          if (href === '#create') {
            return (
              <li key={label} className="flex justify-center">
                <button onClick={() => openCreate('menu')} aria-haspopup="dialog" className="flex flex-col items-center gap-0.5 pt-1 text-[0.65rem] font-medium text-teal-deep">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-teal text-white shadow-[0_8px_18px_-6px_rgb(18_170_168/0.8)] transition active:scale-95">
                    <Plus className="h-6 w-6" strokeWidth={2.2} />
                  </span>
                  {label}
                </button>
              </li>
            )
          }
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn('relative flex h-full flex-col items-center justify-center gap-1 text-[0.65rem] font-medium transition-colors', active ? 'text-teal-deep' : 'text-navy-soft')}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.1 : 1.7} fill={active && label === 'Home' ? 'currentColor' : 'none'} />
                {label}
                {label === 'Messages' && unreadMsgs > 0 && <span className="absolute right-[calc(50%-18px)] top-2.5 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-cream" />}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
