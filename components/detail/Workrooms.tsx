'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Briefcase, CheckCircle2, ExternalLink, Hash, Plus, Send, UserPlus, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { TimeAgo } from '@/components/cards'
import { TextField } from '@/components/ui/fields'
import { Avatar, Button, Card, Tag } from '@/components/ui/primitives'
import {
  addChannel,
  addInvoice,
  addWorkroomMember,
  completeContract,
  createWorkroom,
  markInvoicePaid,
  markWorkroomRead,
  postWorkMessage,
} from '@/lib/store/actions'
import { perform, useHydrated, useWorld, withAuth } from '@/lib/store/hooks'
import { formatPrice, person } from '@/lib/store/selectors'
import type { Contract, WorldState } from '@/lib/types'
import { openAuth } from '@/lib/ui'
import { cn } from '@/lib/cn'
import { NotFoundHere, Shell } from './Shell'

const LOCAL_NOTE = 'Workrooms are saved on this device for now. Teammates will see messages live once PLACES connects to the cloud.'

const myRooms = (s: WorldState) => (s.accountId ? (s.workrooms ?? []).filter((w) => w.memberIds.includes(s.accountId!)) : [])

/* ------------------------------------------------------------------ */
/* List                                                                 */
/* ------------------------------------------------------------------ */

export function WorkroomsPage() {
  const world = useWorld()
  const ready = useHydrated()
  const router = useRouter()
  const [name, setName] = useState('')
  const rooms = myRooms(world)

  if (ready && !world.accountId)
    return (
      <Shell width="max-w-3xl">
        <div className="rounded-panel bg-white/70 px-6 py-16 text-center">
          <Users className="mx-auto h-10 w-10 text-teal" />
          <h1 className="mt-4 font-serif text-3xl">Workrooms</h1>
          <p className="mt-2 text-muted">A calm shared space for your team or the people you hire: channels, chat and payments in one place.</p>
          <Button className="mt-6" onClick={() => openAuth({ mode: 'join' })}>
            Join PLACES
          </Button>
        </div>
      </Shell>
    )

  return (
    <Shell width="max-w-3xl">
      <h1 className="font-serif text-4xl">Workrooms</h1>
      <p className="mt-1 text-muted">Your in-house space for teams and hires — channels, chat and contracts.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          withAuth(() => {
            const r = perform((s, now) => createWorkroom(s, name, now), 'Workroom created.')
            if (r.ok) router.push(`/workroom/?id=${r.id}`)
          })
        }}
        className="mt-6 flex gap-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name a new workroom, e.g. Spring launch team" aria-label="New workroom name" className="h-12 min-w-0 flex-1 rounded-full border border-line bg-white px-5 outline-none focus:border-teal/60" />
        <Button type="submit" className="!h-12">
          <Plus className="h-4 w-4" /> Create
        </Button>
      </form>
      <ul className="mt-6 grid gap-3">
        {rooms.length === 0 && <li className="rounded-2xl bg-white/60 py-12 text-center text-muted">No workrooms yet. Create one, or hire someone in WorkPlace to get one automatically.</li>}
        {rooms.map((w) => {
          const last = w.messages.at(-1)
          const unread = w.messages.some((m) => m.senderId !== world.accountId && m.createdAt > (w.readAt[world.accountId!] ?? 0))
          const contract = (world.contracts ?? []).find((c) => c.id === w.contractId)
          return (
            <li key={w.id}>
              <Link href={`/workroom/?id=${w.id}`}>
                <Card lift className="flex items-center gap-4 p-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-wash text-teal-deep">{contract ? <Briefcase className="h-5 w-5" /> : <Users className="h-5 w-5" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{w.name}</span>
                      {contract && <Tag tone={contract.status === 'active' ? 'teal' : 'neutral'}>{contract.status === 'active' ? 'Contract' : 'Completed'}</Tag>}
                    </span>
                    <span className="block truncate text-sm text-muted">{last ? `${person(world, last.senderId).name}: ${last.body}` : `${w.memberIds.length} member${w.memberIds.length === 1 ? '' : 's'}`}</span>
                  </span>
                  {unread && <span className="h-2.5 w-2.5 rounded-full bg-teal" aria-label="Unread" />}
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">{LOCAL_NOTE}</p>
    </Shell>
  )
}

/* ------------------------------------------------------------------ */
/* Room                                                                 */
/* ------------------------------------------------------------------ */

export function WorkroomPage() {
  const id = useSearchParams().get('id')
  const world = useWorld()
  const w = (world.workrooms ?? []).find((x) => x.id === id)
  const member = !!w && !!world.accountId && w.memberIds.includes(world.accountId)
  const [channelId, setChannelId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [invite, setInvite] = useState('')
  const [newChannel, setNewChannel] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const channel = w?.channels.find((c) => c.id === channelId) ?? w?.channels[0]
  const messages = w && channel ? w.messages.filter((m) => m.channelId === channel.id) : []
  const lastSeen = w && world.accountId ? (w.readAt[world.accountId] ?? 0) : 0
  const hasUnread = !!w && w.messages.some((m) => m.senderId !== world.accountId && m.createdAt > lastSeen)

  useEffect(() => {
    if (member && hasUnread) perform((s, now) => markWorkroomRead(s, w!.id, now))
  }, [member, hasUnread, w])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, channel?.id])

  if (!w || !member)
    return (
      <Shell width="max-w-3xl" back={{ href: '/workrooms', label: 'Workrooms' }}>
        <NotFoundHere what="workroom" href="/workrooms" label="Your workrooms" />
      </Shell>
    )

  const contract = (world.contracts ?? []).find((c) => c.id === w.contractId)

  return (
    <Shell width="max-w-7xl" back={{ href: '/workrooms', label: 'Workrooms' }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">{w.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex -space-x-2">
              {w.memberIds.slice(0, 6).map((m) => {
                const p = person(world, m)
                return <Avatar key={m} src={p.avatar} alt={p.name} name={p.name} size={30} ring />
              })}
            </span>
            <span className="text-sm text-muted">
              {w.memberIds.length} member{w.memberIds.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (perform((s, now) => addWorkroomMember(s, w.id, invite, now), 'Member added.').ok) setInvite('')
          }}
          className="flex items-center gap-2 rounded-full border border-line bg-white p-1 pl-4"
        >
          <UserPlus className="h-4 w-4 text-teal" />
          <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Add by @username" aria-label="Add a member by username" className="w-40 bg-transparent text-sm outline-none" />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </div>

      <div className={cn('mt-6 grid grid-cols-1 gap-4', contract ? 'lg:grid-cols-[220px_1fr_320px]' : 'md:grid-cols-[220px_1fr]')}>
        {/* Channels */}
        <aside className="rounded-panel border border-line/70 bg-white/70 p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Channels</p>
          <ul className="scrollbar-none flex gap-1 overflow-x-auto md:flex-col">
            {w.channels.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setChannelId(c.id)}
                  aria-current={channel?.id === c.id ? 'true' : undefined}
                  className={cn('flex w-full shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-left text-sm', channel?.id === c.id ? 'bg-teal-wash font-semibold text-teal-deep' : 'hover:bg-ivory')}
                >
                  <Hash className="h-3.5 w-3.5" /> {c.name}
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const r = perform((s) => addChannel(s, w.id, newChannel))
              if (r.ok) {
                setNewChannel('')
                setChannelId(r.id!)
              }
            }}
            className="mt-2 flex items-center gap-1 px-1"
          >
            <input value={newChannel} onChange={(e) => setNewChannel(e.target.value)} placeholder="+ new channel" aria-label="New channel name" className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm outline-none focus:bg-ivory" />
          </form>
        </aside>

        {/* Chat */}
        <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-panel border border-line/70 bg-white/80">
          <header className="border-b border-line/60 px-5 py-3 font-semibold">#{channel?.name}</header>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            {messages.length === 0 && <p className="m-auto text-sm text-muted">This is the start of #{channel?.name}.</p>}
            {messages.map((m) => {
              const p = person(world, m.senderId)
              return (
                <div key={m.id} className="flex gap-3">
                  <Avatar src={p.avatar} alt="" name={p.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">{p.name}</span> <TimeAgo ts={m.createdAt} className="text-xs text-muted" />
                    </p>
                    <p className="whitespace-pre-line text-navy-soft">{m.body}</p>
                  </div>
                </div>
              )
            })}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (channel && perform((s, now) => postWorkMessage(s, w.id, channel.id, draft, now)).ok) setDraft('')
            }}
            className="flex items-center gap-2 border-t border-line/60 p-3"
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message #${channel?.name}`} aria-label={`Message #${channel?.name}`} className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 outline-none focus:border-teal/60" />
            <button aria-label="Send" className="grid h-11 w-11 place-items-center rounded-full bg-teal text-white">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>

        {contract && <ContractPanel c={contract} />}
      </div>
      <p className="mt-3 text-xs text-muted">{LOCAL_NOTE}</p>
    </Shell>
  )
}

/* ------------------------------------------------------------------ */
/* Contract & payments                                                  */
/* ------------------------------------------------------------------ */

function ContractPanel({ c }: { c: Contract }) {
  const world = useWorld()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [payLink, setPayLink] = useState('')
  const isWorker = c.workerId === world.accountId
  const isEmployer = c.employerId === world.accountId
  const paid = c.invoices.filter((i) => i.status === 'paid').reduce((n, i) => n + i.amount, 0)
  const open = c.invoices.filter((i) => i.status === 'open').reduce((n, i) => n + i.amount, 0)

  return (
    <aside className="grid min-w-0 grid-cols-1 content-start gap-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Contract</p>
          <Tag tone={c.status === 'active' ? 'teal' : 'neutral'}>{c.status === 'active' ? 'Active' : 'Completed'}</Tag>
        </div>
        <p className="mt-2 font-serif text-xl leading-snug">{c.title}</p>
        <p className="mt-1 text-sm text-muted">
          {person(world, c.employerId).name} hired {person(world, c.workerId).name} · {c.rate}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-ivory p-3">
            <p className="font-semibold">{formatPrice(paid)}</p>
            <p className="text-xs text-muted">Paid</p>
          </div>
          <div className="rounded-xl bg-ivory p-3">
            <p className="font-semibold">{formatPrice(open)}</p>
            <p className="text-xs text-muted">Awaiting payment</p>
          </div>
        </div>
      </Card>

      <Card className="grid gap-3 p-5">
        <p className="font-semibold">Payments</p>
        {c.invoices.length === 0 && <p className="text-sm text-muted">{isWorker ? 'Request payment when a milestone is done.' : 'Payment requests from your hire will appear here.'}</p>}
        {c.invoices.map((i) => (
          <div key={i.id} className="rounded-xl border border-line/70 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{formatPrice(i.amount)}</span>
              {i.status === 'paid' ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-deep">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                </span>
              ) : (
                <Tag tone="sun">Open</Tag>
              )}
            </div>
            <p className="mt-1 text-navy-soft">{i.description}</p>
            <p className="text-xs text-muted">
              Requested <TimeAgo ts={i.createdAt} />
            </p>
            {isEmployer && i.status === 'open' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {i.payLink && (
                  <a href={i.payLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full bg-teal px-3 text-xs font-medium text-white">
                    Pay {formatPrice(i.amount)} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  onClick={() => confirm(`Mark ${formatPrice(i.amount)} as paid?`) && perform((s, now) => markInvoicePaid(s, c.id, i.id, now), 'Marked as paid.')}
                  className="inline-flex h-8 items-center rounded-full border border-line px-3 text-xs font-medium"
                >
                  Mark as paid
                </button>
              </div>
            )}
          </div>
        ))}

        {isWorker && c.status === 'active' && (
          <form
            className="mt-2 grid gap-3 border-t border-line/60 pt-3"
            onSubmit={(e) => {
              e.preventDefault()
              const cents = Math.round(parseFloat(amount.replace(/[^0-9.]/g, '') || '0') * 100)
              if (perform((s, now) => addInvoice(s, c.id, { amount: cents, description, payLink }, now), 'Payment requested.').ok) {
                setAmount('')
                setDescription('')
              }
            }}
          >
            <p className="text-sm font-medium">Request a payment</p>
            <TextField label="Amount (USD)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250.00" />
            <TextField label="For" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Homepage design — milestone 1" />
            <TextField label="Your payment link (optional)" type="url" value={payLink} onChange={(e) => setPayLink(e.target.value)} placeholder="https://buy.stripe.com/…" hint="A Stripe Payment Link for this amount, so your employer can pay in one click." />
            <Button type="submit">Request payment</Button>
          </form>
        )}
        {isEmployer && c.status === 'active' && (
          <Button variant="outline" size="sm" onClick={() => confirm('Mark this contract as complete?') && perform((s, now) => completeContract(s, c.id, now), 'Contract completed.')}>
            Complete contract
          </Button>
        )}
      </Card>
      <p className="text-xs text-muted">Paying directly inside PLACES (with automatic payouts to the person you hired) arrives when the cloud backend and Stripe Connect are connected.</p>
    </aside>
  )
}
