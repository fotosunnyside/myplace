'use client'

import Image from 'next/image'
import {
  Bookmark,
  ChevronUp,
  Gem,
  Heart,
  Leaf,
  Megaphone,
  MessageCircle,
  Palette,
  Share2,
  Sun,
  Users,
  Waves,
} from 'lucide-react'
import { useState } from 'react'
import type { Discussion, LearningItem, Opportunity, Post, Product, Shop } from '@/lib/types'
import { Avatar, Card, Tag } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

/* ------------------------------------------------------------------ */
/* Shared save / like toggle                                            */
/* ------------------------------------------------------------------ */

function useToggle(initial = false) {
  const [on, setOn] = useState(initial)
  return [on, () => setOn((v) => !v)] as const
}

/* ------------------------------------------------------------------ */
/* MindPlace                                                            */
/* ------------------------------------------------------------------ */

export function LearningCard({ item }: { item: LearningItem }) {
  return (
    <Card lift className="group flex min-w-0 gap-1.5 p-1.5 @3xl:flex-col @3xl:gap-0 @3xl:overflow-hidden @3xl:p-0">
      <div className="relative h-11 w-7 shrink-0 overflow-hidden rounded-md @3xl:h-36 @3xl:w-full @3xl:rounded-none">
        <Image src={item.image} alt="" fill sizes="(min-width: 1024px) 280px, 80px" className="object-cover transition duration-700 ease-gentle group-hover:scale-105" />
        {item.kind === 'live' && (
          <span className="absolute left-2 top-2 hidden rounded-full bg-coral px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-white @3xl:inline">
            Live
          </span>
        )}
      </div>
      <div className="min-w-0 @3xl:p-4">
        <p className="line-clamp-2 text-[0.56rem] font-semibold leading-tight text-navy @3xl:text-base">{item.title}</p>
        <p className="truncate text-[0.5rem] text-muted @3xl:text-sm">{item.subtitle}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[0.48rem] text-muted @3xl:mt-3 @3xl:text-xs">
          <Users className="h-2.5 w-2.5 text-teal @3xl:h-3.5 @3xl:w-3.5" />
          {item.members}
        </p>
      </div>
    </Card>
  )
}

export function DiscussionRow({ d }: { d: Discussion }) {
  const [up, toggle] = useToggle()
  return (
    <li className="flex items-center gap-3 py-2.5 @3xl:gap-4 @3xl:py-4">
      <Avatar src={d.author.avatar} alt={d.author.name} size={30} className="@3xl:!h-11 @3xl:!w-11" />
      <div className="min-w-0 flex-1">
        <a href="#" className="block truncate text-[0.7rem] font-semibold text-navy hover:text-teal-deep @3xl:text-base">
          {d.title}
        </a>
        <div className="mt-1 flex items-center gap-2 text-[0.6rem] text-muted @3xl:text-xs">
          <Tag tone={d.categoryTone} className="!text-[0.55rem] @3xl:!text-[0.7rem]">
            {d.category}
          </Tag>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="hidden h-3 w-3 @3xl:inline" />
            {d.comments} comments
          </span>
        </div>
      </div>
      <span className="hidden text-[0.6rem] text-muted @xs:block @3xl:text-xs">{d.postedAgo}</span>
      <button
        onClick={toggle}
        aria-pressed={up}
        aria-label={`Upvote (${d.upvotes})`}
        className={cn(
          'flex w-12 items-center justify-end gap-1 rounded-full text-[0.7rem] font-medium transition-colors @3xl:w-16 @3xl:text-sm',
          up ? 'text-teal-deep' : 'text-muted hover:text-navy',
        )}
      >
        <ChevronUp className={cn('h-4 w-4 transition-transform', up && '-translate-y-0.5')} />
        {d.upvotes}
      </button>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* MarketPlace                                                          */
/* ------------------------------------------------------------------ */

function HeartButton({ className }: { className?: string }) {
  const [on, toggle] = useToggle()
  return (
    <button
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Remove from saved' : 'Save'}
      className={cn(
        'grid h-6 w-6 place-items-center rounded-full bg-white/90 text-navy shadow-soft backdrop-blur transition active:scale-90 @3xl:h-8 @3xl:w-8',
        className,
      )}
    >
      <Heart className={cn('h-3 w-3 @3xl:h-4 @3xl:w-4', on && 'fill-coral text-coral')} strokeWidth={2} />
    </button>
  )
}

export function ShopCard({ shop }: { shop: Shop }) {
  return (
    <a href="#" className="group block min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-soft @3xl:rounded-2xl">
        <Image src={shop.image} alt="" fill sizes="(min-width: 1024px) 360px, 140px" className="object-cover transition duration-700 ease-gentle group-hover:scale-105" />
        <HeartButton className="absolute right-1.5 top-1.5 @3xl:right-3 @3xl:top-3" />
      </div>
      <p className="mt-1.5 truncate text-[0.65rem] font-semibold text-navy @3xl:mt-3 @3xl:text-base">{shop.name}</p>
      <p className="truncate text-[0.55rem] text-muted @3xl:text-sm">{shop.category}</p>
    </a>
  )
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <a href="#" className="group block min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand shadow-soft @3xl:aspect-square @3xl:rounded-2xl">
        <Image src={product.image} alt="" fill sizes="(min-width: 1024px) 260px, 110px" className="object-cover transition duration-700 ease-gentle group-hover:scale-105" />
        <HeartButton className="absolute right-1 top-1 @3xl:right-3 @3xl:top-3" />
      </div>
      <p className="mt-1.5 truncate text-[0.58rem] font-medium text-navy @3xl:mt-3 @3xl:text-[0.95rem]">{product.title}</p>
      <p className="hidden truncate text-xs text-muted @3xl:block">{product.shop}</p>
      <p className="text-[0.6rem] font-semibold text-navy @3xl:mt-1 @3xl:text-sm">{product.price}</p>
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* WorkPlace                                                            */
/* ------------------------------------------------------------------ */

const oppIcons = { leaf: Leaf, sun: Sun, waves: Waves, gem: Gem, megaphone: Megaphone, palette: Palette }
const oppTones = {
  leaf: 'bg-[#e6f1e7] text-leaf',
  sun: 'bg-[#fff4d9] text-[#e6a619]',
  sky: 'bg-[#dcebfb] text-[#3a79c9]',
  teal: 'bg-teal-wash text-teal-deep',
  coral: 'bg-[#fdebe6] text-coral',
  lavender: 'bg-[#efeaf8] text-[#8a73c2]',
}

export function OpportunityRow({ o }: { o: Opportunity }) {
  const [saved, toggle] = useToggle()
  const Icon = oppIcons[o.icon]
  return (
    <Card lift className="flex items-start gap-3 p-2.5 @3xl:items-center @3xl:gap-5 @3xl:p-5">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl @3xl:h-14 @3xl:w-14 @3xl:rounded-2xl', oppTones[o.iconTone])}>
        <Icon className="h-5 w-5 @3xl:h-7 @3xl:w-7" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <a href="#" className="truncate text-[0.68rem] font-semibold text-navy hover:text-teal-deep @3xl:text-base">
            {o.title}
          </a>
          <span className="shrink-0 text-[0.62rem] font-semibold text-teal-deep @3xl:hidden">{o.pay}</span>
        </div>
        <p className="text-[0.55rem] text-muted @3xl:text-sm">
          {o.location} · {o.type}
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
      <button onClick={toggle} aria-pressed={saved} aria-label={saved ? 'Unsave' : 'Save'} className="shrink-0 rounded-full p-1 text-navy hover:bg-navy/5">
        <Bookmark className={cn('h-4 w-4 @3xl:h-5 @3xl:w-5', saved && 'fill-teal text-teal')} strokeWidth={1.8} />
      </button>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* YourPlace                                                            */
/* ------------------------------------------------------------------ */

export function PostCard({ post }: { post: Post }) {
  const [liked, toggle] = useToggle()
  return (
    <article className="border-t border-line/70 pt-3 @3xl:rounded-card @3xl:border @3xl:bg-white/80 @3xl:p-5 @3xl:shadow-soft">
      <header className="flex items-center gap-2 @3xl:gap-3">
        <Avatar src={post.author.avatar} alt={post.author.name} size={30} className="@3xl:!h-11 @3xl:!w-11" />
        <p className="text-[0.62rem] leading-tight @3xl:text-sm">
          <span className="font-semibold text-navy">{post.author.name}</span>{' '}
          <span className="text-muted">
            @{post.author.username} · {post.postedAgo}
          </span>
        </p>
      </header>
      <p className="mt-2 text-[0.62rem] leading-snug text-navy @3xl:mt-3 @3xl:text-[0.95rem] @3xl:leading-relaxed">{post.body}</p>
      {post.image && (
        <div className="relative mt-2 aspect-[16/8] overflow-hidden rounded-xl @3xl:mt-4 @3xl:rounded-2xl">
          <Image src={post.image} alt="" fill sizes="(min-width: 1024px) 640px, 320px" className="object-cover" />
        </div>
      )}
      <footer className="mt-3 hidden items-center gap-6 text-sm text-muted @3xl:flex">
        <button onClick={toggle} aria-pressed={liked} className={cn('inline-flex items-center gap-1.5 hover:text-navy', liked && 'text-coral')}>
          <Heart className={cn('h-[18px] w-[18px]', liked && 'fill-coral')} /> {post.likes + (liked ? 1 : 0)}
        </button>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle className="h-[18px] w-[18px]" /> {post.comments}
        </span>
        <button className="ml-auto inline-flex items-center gap-1.5 hover:text-navy">
          <Share2 className="h-[18px] w-[18px]" /> Share
        </button>
      </footer>
    </article>
  )
}

