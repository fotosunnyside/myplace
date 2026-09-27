'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, LogOut, Receipt, Settings, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { SearchField } from '@/components/search/SearchField'
import { Avatar, Button } from '@/components/ui/primitives'
import { signOut } from '@/lib/store/actions'
import { perform, useHydrated, useWorld } from '@/lib/store/hooks'
import { me, unreadNotifications, unreadThreads } from '@/lib/store/selectors'
import { openAuth, openCreate } from '@/lib/ui'
import { cn } from '@/lib/cn'

export const primaryNav = [
  { label: 'Explore', href: '/explore' },
  { label: 'Communities', href: '/mindplace' },
  { label: 'Opportunities', href: '/workplace' },
  { label: 'Messages', href: '/messages' },
]

const norm = (p: string) => p.replace(/\/$/, '') || '/'

/** Floating, translucent desktop/tablet header. Transparent over the home world until scrolled. */
export function SiteHeader() {
  const pathname = norm(usePathname())
  const [scrolled, setScrolled] = useState(false)
  const world = useWorld()
  const ready = useHydrated()
  const account = me(world)
  const unread = unreadNotifications(world)
  const unreadMsgs = unreadThreads(world)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 lg:ml-[5vw] lg:flex xl:ml-[8vw]">
          {primaryNav.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn('relative rounded-full px-4 py-2 text-[0.92rem] font-medium text-navy transition-colors hover:bg-navy/[0.04]', active && 'text-teal-deep')}
              >
                {item.label}
                {item.href === '/messages' && unreadMsgs > 0 && (
                  <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[0.65rem] font-semibold text-white">{unreadMsgs}</span>
                )}
                {active && <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-teal" />}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:gap-4">
          <SearchField placeholder="Search people, places, products..." className="w-[clamp(200px,22vw,340px)]" />
          {!ready ? (
            <span className="h-11 w-[150px]" aria-hidden />
          ) : account ? (
            <>
              <Button size="sm" variant="soft" onClick={() => openCreate('menu')} className="hidden !h-10 !px-4 xl:inline-flex">
                + Create
              </Button>
              <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} new` : ''}`} className="relative grid h-10 w-10 place-items-center rounded-full text-navy transition hover:bg-navy/5">
                <Bell className="h-[22px] w-[22px]" strokeWidth={1.6} />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[0.6rem] font-semibold text-white ring-2 ring-cream">{unread}</span>}
              </Link>
              <AccountMenu name={account.name} avatar={account.avatar} />
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => openAuth({ mode: 'signin' })} className="!h-10">
                Sign in
              </Button>
              <Button size="sm" onClick={() => openAuth({ mode: 'join' })} className="!h-10 !px-5">
                Join PLACES
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function AccountMenu({ name, avatar }: { name: string; avatar: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const items = [
    { label: 'Your profile', href: '/yourplace', icon: UserRound },
    { label: 'Orders & applications', href: '/activity', icon: Receipt },
    { label: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" className="rounded-full">
        <Avatar src={avatar} alt="" name={name} size={46} ring />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+10px)] w-60 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-lift">
          <p className="px-3 pb-2 pt-2 text-sm font-semibold">{name}</p>
          {items.map(({ label, href, icon: Icon }) => (
            <Link key={href} role="menuitem" href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-ivory">
              <Icon className="h-4 w-4 text-teal-deep" /> {label}
            </Link>
          ))}
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              perform(signOut, 'Signed out.')
              router.push('/')
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ivory"
          >
            <LogOut className="h-4 w-4 text-teal-deep" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
