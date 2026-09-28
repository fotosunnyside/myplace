'use client'

import Link from 'next/link'
import { ArrowRight, Bookmark, MessageSquare, Receipt, Users } from 'lucide-react'
import { Shell } from '@/components/detail/Shell'
import { Card } from '@/components/ui/primitives'
import { backendConfigured } from '@/lib/backend/client'
import { useRoomSession } from '@/lib/spaces/live'
import { useMe } from '@/lib/store/hooks'
import { LiveSpacesSection } from './LiveSpacesSection'

const corner = [
  { href: '/workrooms', label: 'Workrooms', note: 'Your teams and contracts', icon: Users },
  { href: '/messages', label: 'Messages', note: 'Every conversation, one inbox', icon: MessageSquare },
  { href: '/activity', label: 'Activity', note: 'Orders, applications, learning', icon: Receipt },
  { href: '/yourplace', label: 'Saved', note: 'Collections on YourPlace', icon: Bookmark },
]

/** MyPlace: your own corner of PLACES, and home of its live Virtual Spaces. */
export function MyPlacePage() {
  const me = useMe()
  const session = useRoomSession()
  const inside = (session.phase === 'in-room' || session.phase === 'reconnecting') && session.space

  return (
    <Shell width="max-w-6xl">
      <header className="mb-8 md:mb-10">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.32em] text-teal-deep">MyPlace</p>
        <h1 className="mt-2 font-serif text-[clamp(2.4rem,6vw,3.6rem)] leading-[1.02]">{me ? `Good to see you, ${me.name.split(' ')[0]}.` : 'Your corner of the world.'}</h1>
        <p className="mt-3 max-w-xl text-lg text-navy-soft">Step into a live room and be somewhere with other people — or pick up where you left off.</p>
      </header>

      {inside && (
        <Link
          href={`/myplace/space/?room=${session.space!.slug}`}
          className="mb-8 flex items-center justify-between gap-4 rounded-panel bg-navy px-5 py-4 text-white shadow-soft transition hover:bg-navy-soft"
        >
          <span>
            <span className="block text-[0.65rem] uppercase tracking-[0.2em] text-aqua">You’re in</span>
            <span className="font-serif text-2xl">{session.space!.name}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            Return <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      <div className="@container">
        <LiveSpacesSection showAll={false} className="!px-0" />
      </div>
      {!backendConfigured && (
        <p className="mt-3 text-center text-xs text-muted">Preview: rooms and presence run on this device until PLACES connects its live backend.</p>
      )}

      <section className="mt-12" aria-labelledby="corner">
        <h2 id="corner" className="mb-4 font-serif text-[1.9rem] leading-tight">Your corner</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {corner.map(({ href, label, note, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card lift className="h-full p-4 md:p-5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-wash text-teal-deep">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 font-semibold">{label}</p>
                <p className="text-sm text-muted">{note}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  )
}
