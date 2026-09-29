'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, MessageSquare, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { TimeAgo } from '@/components/cards'
import { Avatar, Button } from '@/components/ui/primitives'
import { markThreadRead, sendMessage } from '@/lib/store/actions'
import { perform, useHydrated, useWorld } from '@/lib/store/hooks'
import { myThreads, person } from '@/lib/store/selectors'
import { openAuth } from '@/lib/ui'
import { cn } from '@/lib/cn'
import { Shell } from './Shell'

const refHref = (kind: string, id: string) =>
  kind === 'product' ? `/marketplace/product/?id=${id}` : kind === 'shop' ? `/marketplace/shop/?id=${id}` : kind === 'opportunity' ? `/workplace/opportunity/?id=${id}` : '#'

export function MessagesView() {
  const world = useWorld()
  const ready = useHydrated()
  const router = useRouter()
  const activeId = useSearchParams().get('t')
  const threads = myThreads(world)
  const active = threads.find((t) => t.id === activeId)
  const [draft, setDraft] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active && active.messages.some((m) => m.createdAt > active.readAt && m.senderId !== world.accountId)) perform((s, now) => markThreadRead(s, active.id, now))
    end.current?.scrollIntoView({ block: 'end' })
  }, [active, world.accountId])

  if (ready && !world.accountId)
    return (
      <Shell width="max-w-2xl">
        <div className="rounded-panel bg-white/70 px-6 py-16 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-teal" />
          <h1 className="mt-4 font-serif text-3xl">One inbox across every Place</h1>
          <p className="mt-2 text-muted">Message sellers, employers, teachers and friends — all from one identity.</p>
          <Button className="mt-6" onClick={() => openAuth({ mode: 'join' })}>
            Join PLACES FOR US
          </Button>
        </div>
      </Shell>
    )

  const other = (ids: string[]) => person(world, ids.find((i) => i !== world.accountId) ?? ids[0])

  return (
    <Shell width="max-w-6xl">
      <h1 className={cn('font-serif text-4xl', active && 'hidden md:block')}>Messages</h1>
      <div className="mt-5 grid min-h-[60vh] overflow-hidden rounded-panel border border-line/70 bg-white/70 shadow-soft md:grid-cols-[320px_1fr]">
        <ul className={cn('divide-y divide-line/60 border-r border-line/60', active && 'hidden md:block')}>
          {threads.length === 0 && <li className="p-6 text-sm text-muted">No conversations yet. Message a seller, employer or friend to start one.</li>}
          {threads.map((t) => {
            const o = other(t.participantIds)
            const last = t.messages.at(-1)
            const unread = t.messages.some((m) => m.senderId !== world.accountId && m.createdAt > t.readAt)
            return (
              <li key={t.id}>
                <Link href={`/messages/?t=${t.id}`} className={cn('flex items-center gap-3 p-4 transition hover:bg-ivory', t.id === activeId && 'bg-teal-wash/60')}>
                  <Avatar src={o.avatar} alt="" name={o.name} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{o.name}</span>
                      {last && <TimeAgo ts={last.createdAt} className="shrink-0 text-xs text-muted" />}
                    </span>
                    {t.context && <span className="block truncate text-xs text-teal-deep">Re: {t.context.label}</span>}
                    <span className={cn('block truncate text-sm', unread ? 'font-medium text-navy' : 'text-muted')}>{last?.body ?? 'Say hello 👋'}</span>
                  </span>
                  {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal" aria-label="Unread" />}
                </Link>
              </li>
            )
          })}
        </ul>

        {active ? (
          <section className="flex min-h-[60vh] flex-col">
            <header className="flex items-center gap-3 border-b border-line/60 p-4">
              <button onClick={() => router.push('/messages')} aria-label="All conversations" className="grid h-9 w-9 place-items-center rounded-full hover:bg-navy/5 md:hidden">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Link href={`/people/?u=${other(active.participantIds).username}`} className="flex items-center gap-3">
                <Avatar src={other(active.participantIds).avatar} alt="" name={other(active.participantIds).name} size={40} />
                <span>
                  <span className="block font-semibold">{other(active.participantIds).name}</span>
                  {active.context && (
                    <span className="block text-xs text-teal-deep">
                      About{' '}
                      <span className="underline" onClick={(e) => (e.preventDefault(), router.push(refHref(active.context!.kind, active.context!.refId)))}>
                        {active.context.label}
                      </span>
                    </span>
                  )}
                </span>
              </Link>
            </header>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {active.messages.length === 0 && <p className="m-auto text-sm text-muted">Start the conversation.</p>}
              {active.messages.map((m) => {
                const mine = m.senderId === world.accountId
                return (
                  <div key={m.id} className={cn('max-w-[80%] rounded-2xl px-4 py-2.5', mine ? 'self-end rounded-br-sm bg-teal text-white' : 'self-start rounded-bl-sm bg-ivory')}>
                    <p className="whitespace-pre-line">{m.body}</p>
                    <TimeAgo ts={m.createdAt} className={cn('mt-1 block text-[0.68rem]', mine ? 'text-white/70' : 'text-muted')} />
                  </div>
                )
              })}
              <div ref={end} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (perform((s, now) => sendMessage(s, active.id, draft, now)).ok) setDraft('')
              }}
              className="flex items-center gap-2 border-t border-line/60 p-3"
            >
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" aria-label="Write a message" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 outline-none focus:border-teal/60" />
              <button aria-label="Send" className="grid h-11 w-11 place-items-center rounded-full bg-teal text-white">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        ) : (
          <div className="hidden place-items-center p-10 text-center text-muted md:grid">Choose a conversation.</div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Messages are stored on this device for now. Delivery to other people’s devices arrives when PLACES connects to the cloud.</p>
    </Shell>
  )
}
