'use client'

import Image from 'next/image'
import { Sparkles, Send } from 'lucide-react'
import { useState } from 'react'
import { PostCard } from '@/components/cards'
import { Composer } from '@/components/profile/Composer'
import { ProfileSummary } from '@/components/profile/ProfileSummary'
import { FilterPills } from '@/components/ui/FilterPills'
import { Avatar, Card } from '@/components/ui/primitives'
import { posts } from '@/lib/data/content'
import { currentUser } from '@/lib/data/identity'
import { cn } from '@/lib/cn'

const TABS = ['Profile', 'Posts', 'Friends', 'Collections', 'Saved', 'AI Assistant'] as const
type Tab = (typeof TABS)[number]

const FEED_FILTERS = ['All', 'Friends', 'Following', 'Communities']

export function YourPlaceApp({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<Tab>('Profile')

  return (
    <div>
      <nav
        aria-label="YourPlace sections"
        className="scrollbar-none flex gap-4 overflow-x-auto border-b border-line/80 px-4 @3xl:gap-9 @3xl:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={cn(
              'relative shrink-0 py-2.5 text-[0.62rem] font-medium transition-colors @3xl:py-4 @3xl:text-[0.95rem]',
              tab === t ? 'font-semibold text-navy' : 'text-navy-soft hover:text-navy',
            )}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-teal" />}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-[42%_1fr] gap-3 p-4 @3xl:grid-cols-[300px_1fr] @3xl:gap-10 @3xl:px-0 @3xl:py-8">
        <ProfileSummary identity={currentUser} compact={compact} />
        <div className="min-w-0">
          {(tab === 'Profile' || tab === 'Posts') && <Feed compact={compact} mineOnly={tab === 'Posts'} />}
          {tab === 'Friends' && <Friends />}
          {tab === 'Collections' && <Collections />}
          {tab === 'Saved' && <Saved />}
          {tab === 'AI Assistant' && <Assistant />}
        </div>
      </div>
    </div>
  )
}

function Feed({ compact, mineOnly }: { compact: boolean; mineOnly: boolean }) {
  const [filter, setFilter] = useState('All')
  const visible = posts
    .filter((p) => !mineOnly || p.author.username === currentUser.profile.username)
    .filter((p) => filter === 'All' || p.audience === filter.toLowerCase())
    .slice(0, compact ? 1 : undefined)

  return (
    <div className="flex flex-col gap-3 @3xl:gap-5">
      <Composer />
      <FilterPills label="Feed filter" options={FEED_FILTERS} value={filter} onChange={setFilter} className="[&_button]:!h-6 [&_button]:!px-2.5 [&_button]:!text-[0.55rem] @3xl:[&_button]:!h-9 @3xl:[&_button]:!px-5 @3xl:[&_button]:!text-sm" />
      {visible.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {visible.length === 0 && <p className="py-8 text-center text-sm text-muted">Nothing here yet.</p>}
    </div>
  )
}

function Friends() {
  const friends = [
    { name: 'Maya Chen', avatar: '/media/avatar-a.webp', note: 'Luna & Co.' },
    { name: 'Leo Hart', avatar: '/media/avatar-b.webp', note: 'Sustainable Living' },
    { name: 'Ana Ruiz', avatar: '/media/avatar-c.webp', note: 'Remote Creators' },
  ]
  return (
    <ul className="grid gap-3 @3xl:grid-cols-3">
      {friends.map((f) => (
        <Card key={f.name} lift className="flex items-center gap-3 p-4">
          <Avatar src={f.avatar} alt="" size={44} />
          <div>
            <p className="text-sm font-semibold">{f.name}</p>
            <p className="text-xs text-muted">{f.note}</p>
          </div>
        </Card>
      ))}
    </ul>
  )
}

function Collections() {
  return (
    <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-4 @3xl:gap-5">
      {currentUser.collections.map((c) => (
        <li key={c.id}>
          <a href="#" className="group block">
            <div className="relative aspect-square overflow-hidden rounded-2xl shadow-soft">
              <Image src={c.cover} alt="" fill sizes="240px" className="object-cover transition duration-700 ease-gentle group-hover:scale-105" />
            </div>
            <p className="mt-2 text-sm font-semibold">{c.title}</p>
            <p className="text-xs text-muted">{c.itemCount} items</p>
          </a>
        </li>
      ))}
    </ul>
  )
}

function Saved() {
  const labels = { course: 'Course', product: 'Product', opportunity: 'Opportunity', post: 'Post', discussion: 'Discussion', shop: 'Shop' }
  return (
    <ul className="grid gap-3">
      {currentUser.saved.map((s) => (
        <Card key={s.id} className="flex items-center justify-between p-4 text-sm">
          <span>
            <span className="font-semibold">{labels[s.kind]}</span> <span className="text-muted">saved from {s.district}</span>
          </span>
          <span className="text-xs text-muted">{s.savedAt}</span>
        </Card>
      ))}
    </ul>
  )
}

function Assistant() {
  const { profile } = currentUser
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line/70 bg-gradient-to-r from-teal-wash to-cream p-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-teal text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold">Your personal AI</p>
          <p className="text-xs text-muted">Knows your Places, keeps your data yours.</p>
        </div>
      </div>
      <div className="grid gap-3 p-4 text-sm">
        <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-ivory px-4 py-3">
          Good afternoon, {profile.name}! You have 2 new messages, a discussion reply in MindPlace, and 3 new remote roles that match your skills.
        </p>
        <div className="flex flex-wrap gap-2">
          {['Summarize my day', 'Draft a post', 'Find a course'].map((s) => (
            <button key={s} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium hover:border-teal/40">
              {s}
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 rounded-full border border-line bg-white p-1.5 pl-4">
          <span className="sr-only">Ask your assistant</span>
          <input placeholder="Ask anything…" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
          <button aria-label="Send" className="grid h-9 w-9 place-items-center rounded-full bg-teal text-white">
            <Send className="h-4 w-4" />
          </button>
        </label>
      </div>
    </Card>
  )
}
