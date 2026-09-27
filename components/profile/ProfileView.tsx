'use client'

import Link from 'next/link'
import { Folder, FolderPlus, Send, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PostCard } from '@/components/cards'
import { Picture } from '@/components/ui/Picture'
import { FilterPills } from '@/components/ui/FilterPills'
import { Avatar, Button, Card } from '@/components/ui/primitives'
import { Composer } from './Composer'
import { ProfileSummary } from './ProfileSummary'
import { createCollection, deleteCollection, toggleFollow, toggleInCollection } from '@/lib/store/actions'
import { perform, useWorld, withAuth } from '@/lib/store/hooks'
import { enrollmentsOf, everyone, followingOf, isFollowing, myThreads, person, resolveRef, search, unreadNotifications } from '@/lib/store/selectors'
import type { Person, Ref, WorldState } from '@/lib/types'
import { openAuth } from '@/lib/ui'
import { cn } from '@/lib/cn'

const OWN_TABS = ['Profile', 'Posts', 'Friends', 'Collections', 'Saved', 'AI Assistant'] as const
const OTHER_TABS = ['Posts', 'Friends'] as const
type Tab = (typeof OWN_TABS)[number]

/** A person's home in PLACES — yours (editable) or someone else's. */
export function ProfileView({ p, own, compact = false, preview = false }: { p: Person; own: boolean; compact?: boolean; preview?: boolean }) {
  const tabs: readonly Tab[] = own || preview ? OWN_TABS : OTHER_TABS
  const [tab, setTab] = useState<Tab>(tabs[0])

  return (
    <div>
      {preview && !compact && (
        <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-teal-wash/70 px-4 py-3 text-sm text-teal-deep @3xl:mt-6">
          <span>This is an example home. Join to make your own place in PLACES.</span>
          <Button size="sm" onClick={() => openAuth({ mode: 'join' })}>
            Join PLACES
          </Button>
        </div>
      )}
      <nav aria-label="Profile sections" className="scrollbar-none flex gap-4 overflow-x-auto border-b border-line/80 px-4 @3xl:gap-9 @3xl:px-0">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => (preview && t !== 'Profile' && t !== 'Posts' ? openAuth({ mode: 'join', reason: 'Join PLACES to build your own home.' }) : setTab(t))}
            aria-current={tab === t ? 'page' : undefined}
            className={cn('relative shrink-0 py-2.5 text-[0.62rem] font-medium transition-colors @3xl:py-4 @3xl:text-[0.95rem]', tab === t ? 'font-semibold text-navy' : 'text-navy-soft hover:text-navy')}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-teal" />}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-[42%_1fr] gap-3 p-4 @3xl:grid-cols-[300px_1fr] @3xl:gap-10 @3xl:px-0 @3xl:py-8">
        <ProfileSummary p={p} own={own} compact={compact} />
        <div className="min-w-0">
          {tab === 'Profile' && <Feed p={p} own={own || preview} compact={compact} mode="home" />}
          {tab === 'Posts' && <Feed p={p} own={own} compact={compact} mode="mine" />}
          {tab === 'Friends' && <Friends p={p} own={own} />}
          {tab === 'Collections' && own && <Collections />}
          {tab === 'Saved' && own && <Saved />}
          {tab === 'AI Assistant' && own && <Assistant />}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const FILTERS = ['All', 'Following', 'Yours', 'Photos']

function Feed({ p, own, compact, mode }: { p: Person; own: boolean; compact: boolean; mode: 'home' | 'mine' }) {
  const world = useWorld()
  const [filter, setFilter] = useState('All')
  const following = followingOf(world, p.id)
  const visible = world.posts
    .filter((x) => (mode === 'mine' ? x.authorId === p.id : true))
    .filter((x) => {
      if (mode === 'mine' || filter === 'All') return true
      if (filter === 'Following') return following.includes(x.authorId)
      if (filter === 'Yours') return x.authorId === p.id
      return !!x.image
    })
    .slice(0, compact ? 1 : 50)

  return (
    <div className="flex flex-col gap-3 @3xl:gap-5">
      {own && mode === 'home' && <Composer />}
      {mode === 'home' && (
        <FilterPills
          label="Feed filter"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          className="[&_button]:!h-6 [&_button]:!px-2.5 [&_button]:!text-[0.55rem] @3xl:[&_button]:!h-9 @3xl:[&_button]:!px-5 @3xl:[&_button]:!text-sm"
        />
      )}
      {visible.map((x) => (
        <PostCard key={x.id} post={x} compact={compact} />
      ))}
      {visible.length === 0 && (
        <p className="rounded-2xl bg-white/60 py-10 text-center text-sm text-muted">
          {filter === 'Following' ? 'Follow people to see their posts here.' : mode === 'mine' ? 'No posts yet.' : 'Nothing here yet.'}
        </p>
      )}
    </div>
  )
}

function PersonRow({ id }: { id: string }) {
  const world = useWorld()
  const x = person(world, id)
  const on = isFollowing(world, id)
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <Link href={`/people/?u=${x.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar src={x.avatar} alt="" name={x.name} size={44} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{x.name}</span>
          <span className="block truncate text-xs text-muted">{x.headline || `@${x.username}`}</span>
        </span>
      </Link>
      {world.accountId !== id && (
        <Button size="sm" variant={on ? 'outline' : 'soft'} onClick={() => withAuth(() => perform((s) => toggleFollow(s, id)))}>
          {on ? 'Following' : 'Follow'}
        </Button>
      )}
    </Card>
  )
}

function Friends({ p, own }: { p: Person; own: boolean }) {
  const world = useWorld()
  const following = followingOf(world, p.id)
  const suggestions = everyone(world).filter((x) => x.id !== p.id && !following.includes(x.id))
  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h3 className="font-semibold">{own ? 'People you follow' : `${p.name.split(' ')[0]} follows`}</h3>
        {following.length ? (
          <div className="grid gap-3 @3xl:grid-cols-2">
            {following.map((id) => (
              <PersonRow key={id} id={id} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{own ? 'You’re not following anyone yet.' : 'Not following anyone yet.'}</p>
        )}
      </section>
      {own && suggestions.length > 0 && (
        <section className="grid gap-3">
          <h3 className="font-semibold">People to meet</h3>
          <div className="grid gap-3 @3xl:grid-cols-2">
            {suggestions.map((x) => (
              <PersonRow key={x.id} id={x.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function RefTile({ r, action }: { r: Ref; action?: React.ReactNode }) {
  const world = useWorld()
  const item = resolveRef(world, r)
  if (!item) return null
  return (
    <Card lift className="flex items-center gap-3 p-3">
      <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-teal-wash">
          {item.image && <Picture src={item.image} alt="" fill sizes="56px" className="object-cover" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{item.title}</span>
          <span className="block truncate text-xs text-muted">{item.subtitle}</span>
        </span>
      </Link>
      {action}
    </Card>
  )
}

function Collections() {
  const world = useWorld()
  const list = world.accountId ? (world.collections[world.accountId] ?? []) : []
  const [name, setName] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const current = list.find((c) => c.id === open)

  if (current) {
    return (
      <div className="grid gap-4">
        <button onClick={() => setOpen(null)} className="justify-self-start text-sm font-medium text-teal-deep">
          ← All collections
        </button>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-2xl">{current.title}</h3>
          <button onClick={() => confirm('Delete this collection?') && (perform((s) => deleteCollection(s, current.id), 'Collection deleted.'), setOpen(null))} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-coral">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
        {current.items.length ? (
          current.items.map((r) => (
            <RefTile key={r.kind + r.refId} r={r} action={<button onClick={() => perform((s) => toggleInCollection(s, current.id, r))} className="text-xs text-muted hover:text-coral">Remove</button>} />
          ))
        ) : (
          <p className="text-sm text-muted">Add things from your Saved tab.</p>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (perform((s, now) => createCollection(s, name, now), 'Collection created.').ok) setName('')
        }}
        className="flex gap-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" aria-label="New collection name" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-teal/60" />
        <Button type="submit" className="!h-11">
          <FolderPlus className="h-4 w-4" /> Create
        </Button>
      </form>
      {list.length ? (
        <ul className="grid grid-cols-2 gap-4 @3xl:grid-cols-3">
          {list.map((c) => {
            const cover = c.items.map((r) => resolveRef(world, r)?.image).find(Boolean)
            return (
              <li key={c.id}>
                <button onClick={() => setOpen(c.id)} className="group block w-full text-left">
                  <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-teal-wash shadow-soft">
                    {cover ? <Picture src={cover} alt="" fill sizes="240px" className="object-cover transition duration-700 group-hover:scale-105" /> : <Folder className="h-10 w-10 text-teal" />}
                  </div>
                  <p className="mt-2 text-sm font-semibold">{c.title}</p>
                  <p className="text-xs text-muted">{c.items.length} items</p>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Collections group the things you save — courses, products, jobs, posts.</p>
      )}
    </div>
  )
}

function Saved() {
  const world = useWorld()
  const saved = world.accountId ? (world.saved[world.accountId] ?? []) : []
  const collections = world.accountId ? (world.collections[world.accountId] ?? []) : []
  if (!saved.length) return <p className="rounded-2xl bg-white/60 py-10 text-center text-sm text-muted">Tap the bookmark or heart on anything in PLACES to save it here.</p>
  return (
    <div className="grid gap-3">
      {saved.map((r) => (
        <RefTile
          key={r.kind + r.refId}
          r={r}
          action={
            collections.length > 0 && (
              <select
                aria-label="Add to collection"
                value=""
                onChange={(e) => e.target.value && perform((s) => toggleInCollection(s, e.target.value, r), 'Collection updated.')}
                className="h-9 max-w-[9rem] rounded-full border border-line bg-white px-3 text-xs"
              >
                <option value="">+ Collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.items.some((i) => i.kind === r.kind && i.refId === r.refId) ? '✓ ' : ''}
                    {c.title}
                  </option>
                ))}
              </select>
            )
          }
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Built-in assistant — deterministic, runs on this device               */
/* ------------------------------------------------------------------ */

type Msg = { from: 'me' | 'ai'; text: string; links?: { label: string; href: string }[] }

function answer(world: WorldState, q: string): Msg {
  const text = q.toLowerCase()
  const acc = world.accounts.find((a) => a.id === world.accountId)!
  if (/day|summar|what'?s new|update/.test(text)) return summary(world)
  if (/recommend|suggest|for me/.test(text)) return recommend(world, acc.interests)
  const r = search(world, q.replace(/^(find|search|show me|look for)\s+/i, ''))
  if (!r) return { from: 'ai', text: 'Ask me to summarize your day, recommend something, or find anything in PLACES.' }
  const links = [
    ...r.courses.slice(0, 2).map((c) => ({ label: `Course: ${c.title}`, href: `/mindplace/course/?id=${c.id}` })),
    ...r.opportunities.slice(0, 2).map((o) => ({ label: `Opportunity: ${o.title}`, href: `/workplace/opportunity/?id=${o.id}` })),
    ...r.products.slice(0, 2).map((p) => ({ label: `Product: ${p.title}`, href: `/marketplace/product/?id=${p.id}` })),
    ...r.discussions.slice(0, 2).map((d) => ({ label: `Discussion: ${d.title}`, href: `/mindplace/discussion/?id=${d.id}` })),
    ...r.people.slice(0, 2).map((p) => ({ label: `Person: ${p.name}`, href: `/people/?u=${p.username}` })),
  ]
  return links.length
    ? { from: 'ai', text: `Here’s what I found across PLACES for “${q}”:`, links }
    : { from: 'ai', text: `I couldn’t find anything for “${q}” yet. Try a broader word, or start a discussion in MindPlace.` }
}

function summary(world: WorldState): Msg {
  const unreadMsgs = myThreads(world).filter((t) => t.messages.some((m) => m.senderId !== world.accountId && m.createdAt > t.readAt)).length
  const inProgress = enrollmentsOf(world, world.accountId!).filter((e) => {
    const c = world.courses.find((x) => x.id === e.courseId)
    return c && e.completed.length < c.lessons.length
  })
  const next = inProgress[0] && world.courses.find((c) => c.id === inProgress[0].courseId)
  const lines = [
    `You have ${unreadNotifications(world)} new notification${unreadNotifications(world) === 1 ? '' : 's'} and ${unreadMsgs} unread conversation${unreadMsgs === 1 ? '' : 's'}.`,
    next ? `You’re ${inProgress[0].completed.length}/${next.lessons.length} lessons into ${next.title}.` : 'You’re not taking a course right now.',
    `There are ${world.opportunities.length} open opportunities in WorkPlace.`,
  ]
  return {
    from: 'ai',
    text: lines.join(' '),
    links: [{ label: 'Open notifications', href: '/notifications' }, ...(next ? [{ label: `Continue ${next.title}`, href: `/mindplace/course/?id=${next.id}` }] : [])],
  }
}

function recommend(world: WorldState, interests: string[]): Msg {
  const words = interests.map((i) => i.toLowerCase().split(' ')[0])
  const match = (s: string) => words.some((w) => s.toLowerCase().includes(w.slice(0, 5)))
  const courses = world.courses.filter((c) => match(`${c.title} ${c.topic} ${c.description}`)).slice(0, 2)
  const opps = world.opportunities.filter((o) => match(`${o.title} ${o.tags.join(' ')} ${o.description}`)).slice(0, 2)
  const picks = [...(courses.length ? courses : world.courses.slice(0, 2)).map((c) => ({ label: `Course: ${c.title}`, href: `/mindplace/course/?id=${c.id}` })), ...opps.map((o) => ({ label: `Opportunity: ${o.title}`, href: `/workplace/opportunity/?id=${o.id}` }))]
  return { from: 'ai', text: interests.length ? `Based on your interests (${interests.join(', ')}), you might like:` : 'Add interests in Settings for better picks. Popular right now:', links: picks }
}

function Assistant() {
  const world = useWorld()
  const acc = world.accounts.find((a) => a.id === world.accountId)
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ from: 'ai', text: `Hi ${acc?.name.split(' ')[0] ?? 'there'}! I can summarize your day, recommend things for you, or find anything across PLACES.` }])
  const [q, setQ] = useState('')
  const ask = (text: string) => {
    if (!text.trim()) return
    setMsgs((m) => [...m, { from: 'me', text }, answer(world, text)])
    setQ('')
  }
  const chips = useMemo(() => ['Summarize my day', 'Recommend something for me', 'Find remote jobs'], [])

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line/70 bg-gradient-to-r from-teal-wash to-cream p-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-teal text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold">Your personal assistant</p>
          <p className="text-xs text-muted">Runs on your device and only reads your own PLACES data.</p>
        </div>
      </div>
      <div className="grid max-h-[480px] gap-3 overflow-y-auto p-4 text-sm">
        {msgs.map((m, i) => (
          <div key={i} className={cn('max-w-[88%] rounded-2xl px-4 py-3', m.from === 'me' ? 'justify-self-end rounded-tr-sm bg-teal text-white' : 'rounded-tl-sm bg-ivory')}>
            <p>{m.text}</p>
            {m.links && (
              <ul className="mt-2 grid gap-1">
                {m.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="font-medium text-teal-deep hover:underline">
                      {l.label} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-3 border-t border-line/70 p-4">
        <div className="flex flex-wrap gap-2">
          {chips.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium hover:border-teal/40">
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(q)
          }}
          className="flex items-center gap-2 rounded-full border border-line bg-white p-1.5 pl-4"
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything…" aria-label="Ask your assistant" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
          <button aria-label="Send" className="grid h-9 w-9 place-items-center rounded-full bg-teal text-white">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </Card>
  )
}

