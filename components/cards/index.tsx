'use client'

import Link from 'next/link'
import {
  Bookmark,
  Briefcase,
  ChevronUp,
  ExternalLink,
  Gem,
  Heart,
  Leaf,
  MapPin,
  Megaphone,
  MessageCircle,
  Palette,
  Radio,
  Send,
  Sun,
  Trash2,
  Users,
  Waves,
} from 'lucide-react'
import { useState } from 'react'
import type { Course, Discussion, Opportunity, Post, Product, Ref, Shop } from '@/lib/types'
import { Avatar, Card, Tag } from '@/components/ui/primitives'
import { Picture } from '@/components/ui/Picture'
import { addComment, deletePost, isSaved, toggleLike, toggleSave, toggleUpvote, votePoll } from '@/lib/store/actions'
import { perform, useNow, useWorld, withAuth } from '@/lib/store/hooks'
import { count, formatCount, formatPrice, person, timeAgo, timeUntil } from '@/lib/store/selectors'
import { cn } from '@/lib/cn'

export function TimeAgo({ ts, className }: { ts: number; className?: string }) {
  const now = useNow()
  return (
    <time dateTime={new Date(ts).toISOString()} className={className} suppressHydrationWarning>
      {timeAgo(ts, now)}
    </time>
  )
}

/* ------------------------------------------------------------------ */
/* Save (bookmark / heart)                                              */
/* ------------------------------------------------------------------ */

export function SaveButton({ refItem, variant = 'bookmark', className, label }: { refItem: Ref; variant?: 'bookmark' | 'heart'; className?: string; label?: boolean }) {
  const world = useWorld()
  const on = isSaved(world, refItem)
  const Icon = variant === 'heart' ? Heart : Bookmark
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        withAuth(() => perform((s, now) => toggleSave(s, refItem, now), isSaved(world, refItem) ? 'Removed from Saved.' : 'Saved to YourPlace.'), 'Join PLACES to save things you love.')
      }}
      aria-pressed={on}
      aria-label={on ? 'Remove from saved' : 'Save'}
      className={cn('inline-flex items-center gap-1.5 transition active:scale-90', className)}
    >
      <Icon className={cn('h-[1.1em] w-[1.1em]', on && (variant === 'heart' ? 'fill-coral text-coral' : 'fill-teal text-teal'))} strokeWidth={1.9} />
      {label && (on ? 'Saved' : 'Save')}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* MindPlace                                                            */
/* ------------------------------------------------------------------ */

export function LearningCard({ course }: { course: Course }) {
  const world = useWorld()
  const now = useNow()
  const members = count(course.baseMembers, Object.values(world.enrollments).filter((l) => l.some((e) => e.courseId === course.id)).length)
  return (
    <Link href={`/mindplace/course/?id=${course.id}`} className="block min-w-0">
      <Card lift className="group flex h-full min-w-0 gap-1.5 p-1.5 @3xl:flex-col @3xl:gap-0 @3xl:overflow-hidden @3xl:p-0">
        <div className="relative h-11 w-7 shrink-0 overflow-hidden rounded-md @3xl:h-40 @3xl:w-full @3xl:rounded-none">
          <Picture src={course.image} alt="" fill sizes="(min-width: 1024px) 300px, 80px" className="object-cover transition duration-700 ease-gentle group-hover:scale-105" />
          <span className="absolute right-2 top-2 hidden rounded-full bg-white/90 px-2 py-0.5 text-[0.68rem] font-semibold text-navy shadow-soft @3xl:inline">
            {course.price ? formatPrice(course.price) : 'Free'}
          </span>
          {course.kind === 'live' && (
            <span className="absolute left-2 top-2 hidden items-center gap-1 rounded-full bg-coral px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-white @3xl:inline-flex">
              <Radio className="h-3 w-3" /> Live
            </span>
          )}
        </div>
        <div className="min-w-0 @3xl:p-4">
          <p className="line-clamp-2 text-[0.56rem] font-semibold leading-tight text-navy @3xl:text-base">{course.title}</p>
          <p className="truncate text-[0.5rem] text-muted @3xl:text-sm">
            {course.kind === 'live' && course.startsAt ? <span suppressHydrationWarning>{timeUntil(course.startsAt, now)}</span> : course.subtitle}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[0.48rem] text-muted @3xl:mt-3 @3xl:text-xs">
            <Users className="h-2.5 w-2.5 text-teal @3xl:h-3.5 @3xl:w-3.5" />
            {formatCount(members)} members
          </p>
        </div>
      </Card>
    </Link>
  )
}

export function DiscussionRow({ d }: { d: Discussion }) {
  const world = useWorld()
  const author = person(world, d.authorId)
  const up = !!world.accountId && d.upvoters.includes(world.accountId)
  return (
    <li className="flex items-center gap-3 py-2.5 @3xl:gap-4 @3xl:py-4">
      <Avatar src={author.avatar} alt={author.name} name={author.name} size={30} className="@3xl:!h-11 @3xl:!w-11" />
      <div className="min-w-0 flex-1">
        <Link href={`/mindplace/discussion/?id=${d.id}`} className="block truncate text-[0.7rem] font-semibold text-navy hover:text-teal-deep @3xl:text-base">
          {d.title}
        </Link>
        <div className="mt-1 flex items-center gap-2 text-[0.6rem] text-muted @3xl:text-xs">
          <Tag tone={d.tone} className="!text-[0.55rem] @3xl:!text-[0.7rem]">
            {d.category}
          </Tag>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="hidden h-3 w-3 @3xl:inline" />
            {formatCount(count(d.baseReplies, d.replies.length))} comments
          </span>
        </div>
      </div>
      <TimeAgo ts={d.createdAt} className="hidden text-[0.6rem] text-muted @xs:block @3xl:text-xs" />
      <UpvoteButton d={d} up={up} />
    </li>
  )
}

export function UpvoteButton({ d, up, big }: { d: Discussion; up: boolean; big?: boolean }) {
  return (
    <button
      onClick={() => withAuth(() => perform((s) => toggleUpvote(s, d.id)), 'Join PLACES to upvote.')}
      aria-pressed={up}
      aria-label={`Upvote (${count(d.baseUpvotes, d.upvoters.length)})`}
      className={cn(
        'flex items-center justify-end gap-1 rounded-full font-medium transition-colors',
        big ? 'h-10 border border-line bg-white px-4 text-sm' : 'w-12 text-[0.7rem] @3xl:w-16 @3xl:text-sm',
        up ? 'text-teal-deep' : 'text-muted hover:text-navy',
      )}
    >
      <ChevronUp className={cn('h-4 w-4 transition-transform', up && '-translate-y-0.5')} />
      {formatCount(count(d.baseUpvotes, d.upvoters.length))}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* MarketPlace                                                          */
/* ------------------------------------------------------------------ */

const heartBtn = 'grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[0.75rem] text-navy shadow-soft backdrop-blur @3xl:h-9 @3xl:w-9 @3xl:text-base'

export function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link href={`/marketplace/shop/?id=${shop.id}`} className="group block min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-soft @3xl:rounded-2xl">
        <Picture src={shop.image} alt="" fill sizes="(min-width: 1024px) 360px, 140px" className="object-cover transition duration-700 ease-gentle group-hover:scale-105" />
        <SaveButton refItem={{ kind: 'shop', refId: shop.id }} variant="heart" className={cn(heartBtn, 'absolute right-1.5 top-1.5 @3xl:right-3 @3xl:top-3')} />
      </div>
      <p className="mt-1.5 truncate text-[0.65rem] font-semibold text-navy @3xl:mt-3 @3xl:text-base">{shop.name}</p>
      <p className="truncate text-[0.55rem] text-muted @3xl:text-sm">{shop.category}</p>
    </Link>
  )
}

export function ProductCard({ product }: { product: Product }) {
  const world = useWorld()
  const shop = world.shops.find((x) => x.id === product.shopId)
  return (
    <Link href={`/marketplace/product/?id=${product.id}`} className="group block min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand shadow-soft @3xl:aspect-square @3xl:rounded-2xl">
        <Picture src={product.image} alt="" fill sizes="(min-width: 1024px) 260px, 110px" className="object-cover transition duration-700 ease-gentle group-hover:scale-105" />
        <SaveButton refItem={{ kind: 'product', refId: product.id }} variant="heart" className={cn(heartBtn, 'absolute right-1 top-1 @3xl:right-3 @3xl:top-3')} />
      </div>
      <p className="mt-1.5 truncate text-[0.58rem] font-medium text-navy @3xl:mt-3 @3xl:text-[0.95rem]">{product.title}</p>
      <p className="hidden truncate text-xs text-muted @3xl:block">{shop?.name}</p>
      <p className="text-[0.6rem] font-semibold text-navy @3xl:mt-1 @3xl:text-sm">{formatPrice(product.price)}</p>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* WorkPlace                                                            */
/* ------------------------------------------------------------------ */

export const oppIcons = { leaf: Leaf, sun: Sun, waves: Waves, gem: Gem, megaphone: Megaphone, palette: Palette, briefcase: Briefcase }
export const oppTones: Record<string, string> = {
  leaf: 'bg-[#e6f1e7] text-leaf',
  sun: 'bg-[#fff4d9] text-[#e6a619]',
  sky: 'bg-[#dcebfb] text-[#3a79c9]',
  teal: 'bg-teal-wash text-teal-deep',
  coral: 'bg-[#fdebe6] text-coral',
  lavender: 'bg-[#efeaf8] text-[#8a73c2]',
  neutral: 'bg-ivory text-navy',
}

export function OpportunityRow({ o }: { o: Opportunity }) {
  const Icon = oppIcons[o.icon]
  return (
    <Card lift className="relative flex items-start gap-3 p-2.5 @3xl:items-center @3xl:gap-5 @3xl:p-5">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl @3xl:h-14 @3xl:w-14 @3xl:rounded-2xl', oppTones[o.iconTone])}>
        <Icon className="h-5 w-5 @3xl:h-7 @3xl:w-7" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/workplace/opportunity/?id=${o.id}`} className="truncate text-[0.68rem] font-semibold text-navy after:absolute after:inset-0 hover:text-teal-deep @3xl:text-base">
            {o.title}
          </Link>
          <span className="shrink-0 text-[0.62rem] font-semibold text-teal-deep @3xl:hidden">{o.pay}</span>
        </div>
        <p className="text-[0.55rem] text-muted @3xl:text-sm">
          {o.org} · {o.location} · {o.type}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1 @3xl:mt-2 @3xl:gap-1.5">
          {o.tags.map((t) => (
            <Tag key={t} className="!px-2 !text-[0.52rem] @3xl:!px-2.5 @3xl:!text-[0.7rem]">
              {t}
            </Tag>
          ))}
        </div>
      </div>
      <span className="hidden shrink-0 text-base font-semibold text-teal-deep @3xl:block">{o.pay}</span>
      <SaveButton refItem={{ kind: 'opportunity', refId: o.id }} className="relative z-10 shrink-0 rounded-full p-1 text-base text-navy hover:bg-navy/5 @3xl:text-xl" />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* YourPlace                                                            */
/* ------------------------------------------------------------------ */

export function PostCard({ post, compact }: { post: Post; compact?: boolean }) {
  const world = useWorld()
  const author = person(world, post.authorId)
  const mine = world.accountId === post.authorId
  const liked = !!world.accountId && post.likes.includes(world.accountId)
  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState('')
  const totalVotes = post.poll?.reduce((n, o) => n + o.votes.length, 0) ?? 0
  const myVote = post.poll?.find((o) => world.accountId && o.votes.includes(world.accountId))?.id

  return (
    <article className="border-t border-line/70 pt-3 @3xl:rounded-card @3xl:border @3xl:bg-white/80 @3xl:p-5 @3xl:shadow-soft">
      <header className="flex items-center gap-2 @3xl:gap-3">
        <Link href={`/people/?u=${author.username}`}>
          <Avatar src={author.avatar} alt={author.name} name={author.name} size={30} className="@3xl:!h-11 @3xl:!w-11" />
        </Link>
        <div className="min-w-0 flex-1 text-[0.62rem] leading-tight @3xl:text-sm">
          <Link href={`/people/?u=${author.username}`} className="font-semibold text-navy hover:underline">
            {author.name}
          </Link>{' '}
          <span className="text-muted">
            @{author.username} · <TimeAgo ts={post.createdAt} />
          </span>
          {post.location && (
            <span className="mt-0.5 hidden items-center gap-1 text-xs text-muted @3xl:flex">
              <MapPin className="h-3 w-3" /> {post.location}
            </span>
          )}
        </div>
        {mine && !compact && (
          <button
            onClick={() => confirm('Delete this post?') && perform((s) => deletePost(s, post.id), 'Post deleted.')}
            aria-label="Delete post"
            className="hidden rounded-full p-2 text-muted hover:bg-navy/5 hover:text-coral @3xl:block"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>
      {post.body && <p className="mt-2 whitespace-pre-line text-[0.62rem] leading-snug text-navy @3xl:mt-3 @3xl:text-[0.95rem] @3xl:leading-relaxed">{post.body}</p>}
      {post.link && !compact && (
        <a href={post.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 hidden items-center gap-2 truncate rounded-xl bg-ivory px-3 py-2 text-sm text-teal-deep hover:underline @3xl:flex">
          <ExternalLink className="h-4 w-4 shrink-0" /> {post.link.replace(/^https?:\/\//, '')}
        </a>
      )}
      {post.image && (
        <div className="relative mt-2 aspect-[16/8] overflow-hidden rounded-xl @3xl:mt-4 @3xl:aspect-[16/9] @3xl:rounded-2xl">
          <Picture src={post.image} alt="" fill sizes="(min-width: 1024px) 640px, 320px" className="object-cover" />
        </div>
      )}
      {post.poll && !compact && (
        <div className="mt-4 hidden gap-2 @3xl:grid">
          {post.poll.map((o) => {
            const pct = totalVotes ? Math.round((o.votes.length / totalVotes) * 100) : 0
            return (
              <button
                key={o.id}
                onClick={() => withAuth(() => perform((s) => votePoll(s, post.id, o.id)), 'Join PLACES to vote.')}
                aria-pressed={myVote === o.id}
                className={cn('relative overflow-hidden rounded-xl border px-4 py-2.5 text-left text-sm transition', myVote === o.id ? 'border-teal' : 'border-line hover:border-teal/40')}
              >
                {myVote && <span className="absolute inset-y-0 left-0 bg-teal-wash transition-all" style={{ width: `${pct}%` }} />}
                <span className="relative flex justify-between gap-4">
                  <span className={cn(myVote === o.id && 'font-semibold')}>{o.label}</span>
                  {myVote && <span className="text-muted">{pct}%</span>}
                </span>
              </button>
            )
          })}
          <p className="text-xs text-muted">
            {totalVotes} vote{totalVotes === 1 ? '' : 's'}
          </p>
        </div>
      )}
      {!compact && (
        <footer className="mt-3 hidden items-center gap-6 text-sm text-muted @3xl:flex">
          <button
            onClick={() => withAuth(() => perform((s) => toggleLike(s, post.id)), 'Join PLACES to like posts.')}
            aria-pressed={liked}
            className={cn('inline-flex items-center gap-1.5 hover:text-navy', liked && 'text-coral')}
          >
            <Heart className={cn('h-[18px] w-[18px]', liked && 'fill-coral')} /> {formatCount(count(post.baseLikes, post.likes.length))}
          </button>
          <button onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} className="inline-flex items-center gap-1.5 hover:text-navy">
            <MessageCircle className="h-[18px] w-[18px]" /> {formatCount(count(post.baseComments, post.comments.length))}
          </button>
          <SaveButton refItem={{ kind: 'post', refId: post.id }} className="ml-auto text-lg hover:text-navy" />
        </footer>
      )}
      {showComments && (
        <div className="mt-4 grid gap-3 border-t border-line/70 pt-4">
          {post.comments.map((c) => {
            const a = person(world, c.authorId)
            return (
              <div key={c.id} className="flex gap-2.5">
                <Avatar src={a.avatar} alt={a.name} name={a.name} size={30} />
                <div className="rounded-2xl rounded-tl-sm bg-ivory px-3.5 py-2 text-sm">
                  <p className="font-semibold">
                    {a.name} <TimeAgo ts={c.createdAt} className="font-normal text-muted" />
                  </p>
                  <p className="text-navy-soft">{c.body}</p>
                </div>
              </div>
            )
          })}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              withAuth(() => {
                if (perform((s, now) => addComment(s, post.id, draft, now)).ok) setDraft('')
              }, 'Join PLACES to comment.')
            }}
            className="flex items-center gap-2 rounded-full border border-line bg-white p-1 pl-4"
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment…" aria-label="Write a comment" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <button aria-label="Send comment" className="grid h-8 w-8 place-items-center rounded-full bg-teal text-white">
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </article>
  )
}
