import type { Account, ID, Person, Ref, WorldState } from '@/lib/types'

export const me = (s: WorldState): Account | null => s.accounts.find((a) => a.id === s.accountId) ?? null

const FALLBACK: Person = { id: 'unknown', name: 'Former member', username: 'former', avatar: '', bio: '', location: '', headline: '', interests: [], skills: [], joinedAt: 0 }

export const person = (s: WorldState, id: ID): Person => s.accounts.find((a) => a.id === id) ?? s.people.find((p) => p.id === id) ?? FALLBACK

export const personByUsername = (s: WorldState, username: string): Person | undefined =>
  [...s.accounts, ...s.people].find((p) => p.username === username)

export const everyone = (s: WorldState): Person[] => [...s.accounts, ...s.people.filter((p) => p.id !== 'p_guide')]

export const followingOf = (s: WorldState, id: ID) => s.following[id] ?? []

export const followerCount = (s: WorldState, id: ID) =>
  (person(s, id).baseFollowers ?? 0) + Object.values(s.following).filter((list) => list.includes(id)).length

export const isFollowing = (s: WorldState, id: ID) => !!s.accountId && followingOf(s, s.accountId).includes(id)

export const shopOf = (s: WorldState, ownerId: ID) => s.shops.find((x) => x.ownerId === ownerId)
/** Every storefront someone runs (PLACES Pass members can have several). */
export const shopsOf = (s: WorldState, ownerId: ID) => s.shops.filter((x) => x.ownerId === ownerId)

export const enrollmentsOf = (s: WorldState, id: ID) => s.enrollments[id] ?? []

export const unreadNotifications = (s: WorldState) => (s.accountId ? (s.notifications[s.accountId] ?? []).filter((n) => !n.read).length : 0)

export const myThreads = (s: WorldState) => (s.accountId ? s.threads.filter((t) => t.participantIds.includes(s.accountId!)) : [])

export const unreadThreads = (s: WorldState) =>
  myThreads(s).filter((t) => t.messages.some((m) => m.senderId !== s.accountId && m.createdAt > t.readAt)).length

export const count = (base: number | undefined, extra: number) => (base ?? 0) + extra

/** Resolves a saved/collected reference to something displayable. */
export function resolveRef(s: WorldState, ref: Ref): { title: string; subtitle: string; image?: string; href: string } | null {
  switch (ref.kind) {
    case 'post': {
      const p = s.posts.find((x) => x.id === ref.refId)
      return p ? { title: p.body.slice(0, 80) || 'Photo post', subtitle: `Post by ${person(s, p.authorId).name}`, image: p.image, href: `/people/?u=${person(s, p.authorId).username}` } : null
    }
    case 'course': {
      const c = s.courses.find((x) => x.id === ref.refId)
      return c ? { title: c.title, subtitle: `MindPlace · ${c.subtitle}`, image: c.image, href: `/mindplace/course/?id=${c.id}` } : null
    }
    case 'discussion': {
      const d = s.discussions.find((x) => x.id === ref.refId)
      return d ? { title: d.title, subtitle: `MindPlace · ${d.category}`, href: `/mindplace/discussion/?id=${d.id}` } : null
    }
    case 'product': {
      const p = s.products.find((x) => x.id === ref.refId)
      return p ? { title: p.title, subtitle: `MarketPlace · ${formatPrice(p.price)}`, image: p.image, href: `/marketplace/product/?id=${p.id}` } : null
    }
    case 'shop': {
      const x = s.shops.find((y) => y.id === ref.refId)
      return x ? { title: x.name, subtitle: `MarketPlace · ${x.category}`, image: x.image, href: `/marketplace/shop/?id=${x.id}` } : null
    }
    case 'opportunity': {
      const o = s.opportunities.find((x) => x.id === ref.refId)
      return o ? { title: o.title, subtitle: `WorkPlace · ${o.org}`, href: `/workplace/opportunity/?id=${o.id}` } : null
    }
  }
}

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)

/** A course's price as learners see it: Free, $49, or $19/month for a membership. */
export const coursePrice = (c: { price?: number; billing?: 'once' | 'monthly' }) => (c.price ? `${formatPrice(c.price)}${c.billing === 'monthly' ? '/month' : ''}` : 'Free')

export const formatCount = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`
  return String(n)
}

export function timeAgo(ts: number, now: number) {
  const d = Math.max(0, now - ts)
  const m = Math.round(d / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function timeUntil(ts: number, now: number) {
  const d = ts - now
  if (d <= 0) return 'Live now'
  const h = Math.round(d / 3_600_000)
  if (h < 24) return `Starts in ${h}h`
  return `Starts in ${Math.round(h / 24)}d`
}

/** Simple ranked full-text search across the whole world. */
export function search(s: WorldState, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const terms = q.split(/\s+/)
  const score = (...fields: (string | undefined)[]) => {
    const hay = fields.join(' ').toLowerCase()
    return terms.every((t) => hay.includes(t)) ? terms.reduce((n, t) => n + (hay.split(t).length - 1), 0) : 0
  }
  const rank = <T,>(items: T[], f: (x: T) => number) =>
    items
      .map((x) => [x, f(x)] as const)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([x]) => x)
  return {
    people: rank(everyone(s), (p) => score(p.name, p.username, p.bio, p.headline, p.location, p.skills.join(' '), p.interests.join(' '))),
    posts: rank(s.posts, (p) => score(p.body, p.location)),
    courses: rank(s.courses, (c) => score(c.title, c.subtitle, c.description, c.topic)),
    discussions: rank(s.discussions, (d) => score(d.title, d.body, d.category)),
    shops: rank(s.shops, (x) => score(x.name, x.category, x.description)),
    products: rank(s.products, (p) => score(p.title, p.description, p.category)),
    opportunities: rank(s.opportunities, (o) => score(o.title, o.org, o.description, o.tags.join(' '), o.location, o.type)),
  }
}
