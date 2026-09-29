import type {
  Account,
  Ad,
  Application,
  Contract,
  Course,
  CoursePurchase,
  Discussion,
  ID,
  MemberPlan,
  Notification,
  Opportunity,
  Order,
  Person,
  PlanKind,
  Post,
  Product,
  RefKind,
  Shop,
  Thread,
  Workroom,
  WorldState,
} from '@/lib/types'
import { SEED_VERSION } from '../seed'
import { emptyRowSet, keyOf, type CloudData, type Row, type RowSet, type TableName } from './schema'

/* ------------------------------------------------------------------ */
/* Small conversions                                                    */
/* ------------------------------------------------------------------ */

const ms = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : typeof v === 'number' ? v : 0)
const iso = (n: number | undefined) => new Date(n ?? 0).toISOString()
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const opt = <T,>(v: T | null | undefined) => (v === null || v === undefined || v === '' ? undefined : v)
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
const nul = <T,>(v: T | undefined) => (v === undefined ? null : v)

function group<T>(rows: Row[], key: string, map: (r: Row) => T): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const r of rows) {
    const k = String(r[key])
    const list = out.get(k)
    if (list) list.push(map(r))
    else out.set(k, [map(r)])
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Cloud rows → the world the interface reads                           */
/* ------------------------------------------------------------------ */

export interface CloudIdentity {
  id: ID
  email: string
}

export function fromCloud(d: CloudData, me: CloudIdentity | null): WorldState {
  const plans = new Map<ID, Partial<Record<PlanKind, MemberPlan>>>()
  for (const r of d.member_plans) {
    const p = plans.get(str(r.user_id)) ?? {}
    p[r.kind as PlanKind] = { status: r.status as MemberPlan['status'], via: r.via as MemberPlan['via'], since: ms(r.since), renewsAt: ms(r.renews_at), quantity: Number(r.quantity) || 1 }
    plans.set(str(r.user_id), p)
  }

  const toPerson = (r: Row): Person => ({
    id: str(r.id),
    name: str(r.name),
    username: str(r.username),
    avatar: str(r.avatar),
    bio: str(r.bio),
    location: str(r.location),
    headline: str(r.headline),
    website: opt(r.website as string),
    interests: arr(r.interests),
    skills: arr(r.skills),
    joinedAt: ms(r.joined_at),
    baseFollowers: Number(r.base_followers) || undefined,
    baseFollowing: Number(r.base_following) || undefined,
    member: r.user_id !== null && r.user_id !== undefined,
    plans: plans.get(str(r.id)),
  })

  const myRow = me ? d.profiles.find((r) => r.id === me.id) : undefined
  const account: Account | null =
    me && myRow ? { ...toPerson(myRow), email: me.email, openTo: arr(myRow.open_to) as Account['openTo'] } : null

  const following: Record<ID, ID[]> = {}
  for (const f of d.follows) (following[str(f.follower_id)] ??= []).push(str(f.followee_id))

  const likes = group(d.post_likes, 'post_id', (r) => str(r.user_id))
  const comments = group(d.post_comments, 'post_id', (r) => ({ id: str(r.id), authorId: str(r.author_id), body: str(r.body), createdAt: ms(r.created_at) }))
  const votes = group(d.poll_votes, 'post_id', (r) => ({ user: str(r.user_id), option: str(r.option_id) }))
  const posts: Post[] = d.posts
    .map((r) => {
      const id = str(r.id)
      const v = votes.get(id) ?? []
      const poll = Array.isArray(r.poll) ? (r.poll as { id: string; label: string }[]) : undefined
      return {
        id,
        authorId: str(r.author_id),
        body: str(r.body),
        image: opt(r.image as string),
        link: opt(r.link as string),
        location: opt(r.location as string),
        poll: poll?.map((o) => ({ id: o.id, label: o.label, votes: v.filter((x) => x.option === o.id).map((x) => x.user) })),
        audience: (r.audience as Post['audience']) ?? 'public',
        createdAt: ms(r.created_at),
        likes: likes.get(id) ?? [],
        baseLikes: Number(r.base_likes) || undefined,
        comments: (comments.get(id) ?? []).sort((a, b) => a.createdAt - b.createdAt),
        baseComments: Number(r.base_comments) || undefined,
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt)

  const bodies = new Map(d.lesson_bodies.map((r) => [str(r.lesson_id), str(r.body)]))
  const lessons = group(d.course_lessons, 'course_id', (r) => ({ id: str(r.id), position: Number(r.position), title: str(r.title), minutes: Number(r.minutes), body: bodies.get(str(r.id)) ?? '' }))
  const courses: Course[] = d.courses
    .map((r) => ({
      id: str(r.id),
      title: str(r.title),
      subtitle: str(r.subtitle),
      description: str(r.description),
      image: str(r.image),
      kind: r.kind as Course['kind'],
      topic: str(r.topic),
      expertId: str(r.expert_id),
      lessons: (lessons.get(str(r.id)) ?? []).sort((a, b) => a.position - b.position).map(({ id, title, minutes, body }) => ({ id, title, minutes, body })),
      baseMembers: Number(r.base_members) || 0,
      startsAt: r.starts_at ? ms(r.starts_at) : undefined,
      price: Number(r.price) || undefined,
      billing: r.billing === 'monthly' && Number(r.price) ? ('monthly' as const) : undefined,
      stripeLink: opt(r.stripe_link as string),
      createdAt: ms(r.created_at),
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))

  const upvotes = group(d.discussion_upvotes, 'discussion_id', (r) => str(r.user_id))
  const replies = group(d.discussion_replies, 'discussion_id', (r) => ({ id: str(r.id), authorId: str(r.author_id), body: str(r.body), createdAt: ms(r.created_at) }))
  const discussions: Discussion[] = d.discussions
    .map((r) => ({
      id: str(r.id),
      title: str(r.title),
      body: str(r.body),
      authorId: str(r.author_id),
      category: str(r.category),
      tone: r.tone as Discussion['tone'],
      createdAt: ms(r.created_at),
      upvoters: upvotes.get(str(r.id)) ?? [],
      baseUpvotes: Number(r.base_upvotes) || undefined,
      replies: (replies.get(str(r.id)) ?? []).sort((a, b) => a.createdAt - b.createdAt),
      baseReplies: Number(r.base_replies) || undefined,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)

  const shops: Shop[] = d.shops.map((r) => ({ id: str(r.id), name: str(r.name), category: str(r.category), description: str(r.description), image: str(r.image), ownerId: str(r.owner_id), createdAt: ms(r.created_at) }))
  const products: Product[] = d.products
    .map((r) => ({
      id: str(r.id),
      shopId: str(r.shop_id),
      title: str(r.title),
      description: str(r.description),
      price: Number(r.price),
      image: str(r.image),
      category: r.category as Product['category'],
      stripeLink: opt(r.stripe_link as string),
      ships: r.ships ? true : undefined,
      createdAt: ms(r.created_at),
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
  const orders: Order[] = d.orders
    .map((r) => ({ id: str(r.id), productId: str(r.product_id), buyerId: str(r.buyer_id), total: Number(r.total), fee: Number(r.fee) || undefined, via: r.via as Order['via'], createdAt: ms(r.created_at) }))
    .sort((a, b) => b.createdAt - a.createdAt)
  const coursePurchases: CoursePurchase[] = d.course_purchases.map((r) => ({ id: str(r.id), courseId: str(r.course_id), buyerId: str(r.buyer_id), total: Number(r.total), fee: Number(r.fee) || undefined, via: r.via as CoursePurchase['via'], createdAt: ms(r.created_at) }))

  const opportunities: Opportunity[] = d.opportunities
    .map((r) => ({
      id: str(r.id),
      title: str(r.title),
      org: str(r.org),
      postedById: str(r.posted_by),
      icon: r.icon as Opportunity['icon'],
      iconTone: r.icon_tone as Opportunity['iconTone'],
      location: str(r.location),
      type: r.type as Opportunity['type'],
      kind: r.kind as Opportunity['kind'],
      tags: arr(r.tags),
      pay: str(r.pay),
      description: str(r.description),
      createdAt: ms(r.created_at),
      paidVia: opt(r.paid_via as Opportunity['paidVia']),
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
  const applications: Application[] = d.applications
    .map((r) => ({ id: str(r.id), opportunityId: str(r.opportunity_id), applicantId: str(r.applicant_id), message: str(r.message), link: opt(r.link as string), createdAt: ms(r.created_at) }))
    .sort((a, b) => b.createdAt - a.createdAt)

  const ads: Ad[] = d.ads.map((r) => ({
    id: str(r.id),
    ownerId: str(r.owner_id),
    business: str(r.business),
    headline: str(r.headline),
    image: str(r.image),
    url: str(r.url),
    district: r.district as Ad['district'],
    plan: r.plan as Ad['plan'],
    startsAt: ms(r.starts_at),
    endsAt: ms(r.ends_at),
    via: r.via as Ad['via'],
    createdAt: ms(r.created_at),
  }))

  const invoices = group(d.invoices, 'contract_id', (r) => ({
    id: str(r.id),
    amount: Number(r.amount),
    description: str(r.description),
    payLink: opt(r.pay_link as string),
    status: r.status as 'open' | 'paid',
    createdAt: ms(r.created_at),
    paidAt: r.paid_at ? ms(r.paid_at) : undefined,
  }))
  const contracts: Contract[] = d.contracts
    .map((r) => ({
      id: str(r.id),
      title: str(r.title),
      opportunityId: opt(r.opportunity_id as string),
      employerId: str(r.employer_id),
      workerId: str(r.worker_id),
      rate: str(r.rate),
      status: r.status as Contract['status'],
      workroomId: str(r.workroom_id),
      invoices: (invoices.get(str(r.id)) ?? []).sort((a, b) => a.createdAt - b.createdAt),
      createdAt: ms(r.created_at),
    }))
    .sort((a, b) => b.createdAt - a.createdAt)

  const members = group(d.workroom_members, 'workroom_id', (r) => ({ user: str(r.user_id), readAt: ms(r.read_at) }))
  const channels = group(d.workroom_channels, 'workroom_id', (r) => ({ id: str(r.id), name: str(r.name) }))
  const roomMessages = group(d.workroom_messages, 'workroom_id', (r) => ({ id: str(r.id), channelId: str(r.channel_id), senderId: str(r.sender_id), body: str(r.body), createdAt: ms(r.created_at) }))
  const workrooms: Workroom[] = d.workrooms
    .map((r) => {
      const id = str(r.id)
      const m = members.get(id) ?? []
      return {
        id,
        name: str(r.name),
        ownerId: str(r.owner_id),
        memberIds: m.map((x) => x.user),
        channels: (channels.get(id) ?? []).sort((a, b) => (a.name === 'general' ? -1 : b.name === 'general' ? 1 : a.name === 'updates' ? -1 : b.name === 'updates' ? 1 : a.name.localeCompare(b.name))),
        messages: (roomMessages.get(id) ?? []).sort((a, b) => a.createdAt - b.createdAt),
        contractId: opt(r.contract_id as string),
        readAt: Object.fromEntries(m.map((x) => [x.user, x.readAt])),
        createdAt: ms(r.created_at),
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt)

  const participants = group(d.thread_participants, 'thread_id', (r) => ({ user: str(r.user_id), readAt: ms(r.read_at) }))
  const threadMessages = group(d.messages, 'thread_id', (r) => ({ id: str(r.id), senderId: str(r.sender_id), body: str(r.body), createdAt: ms(r.created_at) }))
  const threads: Thread[] = d.threads
    .map((r) => {
      const id = str(r.id)
      const p = participants.get(id) ?? []
      const messages = (threadMessages.get(id) ?? []).sort((a, b) => a.createdAt - b.createdAt)
      const ctx = r.context as { kind: RefKind; refId: ID; label: string } | null
      return {
        id,
        participantIds: [str(r.created_by), ...p.map((x) => x.user).filter((u) => u !== str(r.created_by))],
        messages,
        context: ctx ?? undefined,
        readAt: p.find((x) => x.user === me?.id)?.readAt ?? 0,
        _sort: messages.at(-1)?.createdAt ?? ms(r.created_at),
      }
    })
    .filter((t) => !me || t.participantIds.includes(me.id))
    .sort((a, b) => b._sort - a._sort)
    .map(({ _sort, ...t }) => (void _sort, t))

  const mine = me?.id
  const notifications: Notification[] = d.notifications
    .map((r) => ({ id: str(r.id), text: str(r.text), href: str(r.href), district: r.district as Notification['district'], createdAt: ms(r.created_at), read: !!r.read }))
    .sort((a, b) => b.createdAt - a.createdAt)

  return {
    version: SEED_VERSION,
    accountId: account ? account.id : null,
    accounts: account ? [account] : [],
    people: d.profiles.filter((r) => r.id !== mine).map(toPerson),
    following,
    posts,
    courses,
    enrollments: mine ? { [mine]: d.enrollments.map((r) => ({ courseId: str(r.course_id), startedAt: ms(r.started_at), completed: arr(r.completed) })) } : {},
    discussions,
    shops,
    products,
    orders,
    coursePurchases,
    opportunities,
    applications,
    ads,
    contracts,
    workrooms,
    threads,
    saved: mine
      ? { [mine]: d.saved_items.map((r) => ({ kind: r.kind as RefKind, refId: str(r.ref_id), savedAt: ms(r.saved_at) })).sort((a, b) => b.savedAt - a.savedAt) }
      : {},
    collections: mine
      ? { [mine]: d.collections.map((r) => ({ id: str(r.id), title: str(r.title), items: Array.isArray(r.items) ? (r.items as { kind: RefKind; refId: ID }[]) : [], createdAt: ms(r.created_at) })).sort((a, b) => b.createdAt - a.createdAt) }
      : {},
    notifications: mine ? { [mine]: notifications } : {},
  }
}

/* ------------------------------------------------------------------ */
/* The world → the rows the signed-in member may write                  */
/* ------------------------------------------------------------------ */

/**
 * Derives, from the world, every row the signed-in member owns or may create. Diffing this before and after an
 * action gives exactly the writes that action needs — so every existing action works against the cloud unchanged.
 * Rows that belong to others (their likes, their messages, their notifications) are never produced here.
 */
export function ownedRows(s: WorldState): RowSet {
  const out = emptyRowSet()
  const me = s.accountId
  if (!me) return out
  const put = (t: TableName, row: Row) => out[t].set(keyOf(t, row), row)
  const account = s.accounts.find((a) => a.id === me)

  if (account) {
    put('profiles', {
      id: me,
      name: account.name,
      avatar: account.avatar ?? '',
      bio: account.bio ?? '',
      location: account.location ?? '',
      headline: account.headline ?? '',
      website: account.website ?? null,
      interests: account.interests ?? [],
      skills: account.skills ?? [],
      open_to: account.openTo ?? [],
    })
    for (const [kind, p] of Object.entries(account.plans ?? {})) {
      if (p) put('member_plans', { user_id: me, kind, quantity: p.quantity, status: p.status, via: p.via, since: iso(p.since), renews_at: iso(p.renewsAt) })
    }
  }

  for (const followee of s.following[me] ?? []) put('follows', { follower_id: me, followee_id: followee })

  for (const p of s.posts) {
    if (p.authorId === me) {
      put('posts', {
        id: p.id,
        author_id: me,
        body: p.body,
        image: nul(p.image),
        link: nul(p.link),
        location: nul(p.location),
        poll: p.poll ? p.poll.map((o) => ({ id: o.id, label: o.label })) : null,
        audience: p.audience,
        created_at: iso(p.createdAt),
      })
    }
    if (p.likes.includes(me)) put('post_likes', { post_id: p.id, user_id: me })
    for (const c of p.comments) if (c.authorId === me) put('post_comments', { id: c.id, post_id: p.id, author_id: me, body: c.body, created_at: iso(c.createdAt) })
    const vote = p.poll?.find((o) => o.votes.includes(me))
    if (vote) put('poll_votes', { post_id: p.id, user_id: me, option_id: vote.id })
  }

  for (const x of s.saved[me] ?? []) put('saved_items', { user_id: me, kind: x.kind, ref_id: x.refId, saved_at: iso(x.savedAt) })
  for (const c of s.collections[me] ?? []) put('collections', { id: c.id, user_id: me, title: c.title, items: c.items.map((i) => ({ kind: i.kind, refId: i.refId })), created_at: iso(c.createdAt) })

  for (const c of s.courses) {
    if (c.expertId !== me) continue
    put('courses', {
      id: c.id,
      expert_id: me,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      image: c.image,
      kind: c.kind,
      topic: c.topic,
      price: c.price ?? null,
      billing: c.billing ?? 'once',
      stripe_link: nul(c.stripeLink),
      created_at: iso(c.createdAt),
    })
    c.lessons.forEach((l, i) => {
      put('course_lessons', { id: l.id, course_id: c.id, position: i, title: l.title, minutes: l.minutes })
      put('lesson_bodies', { lesson_id: l.id, course_id: c.id, body: l.body })
    })
  }
  for (const p of s.coursePurchases ?? []) if (p.buyerId === me) put('course_purchases', { id: p.id, course_id: p.courseId, buyer_id: me, via: p.via, created_at: iso(p.createdAt) })
  for (const e of s.enrollments[me] ?? []) put('enrollments', { user_id: me, course_id: e.courseId, started_at: iso(e.startedAt), completed: e.completed })

  for (const d of s.discussions) {
    if (d.authorId === me) put('discussions', { id: d.id, author_id: me, title: d.title, body: d.body, category: d.category, tone: d.tone, created_at: iso(d.createdAt) })
    if (d.upvoters.includes(me)) put('discussion_upvotes', { discussion_id: d.id, user_id: me })
    for (const r of d.replies) if (r.authorId === me) put('discussion_replies', { id: r.id, discussion_id: d.id, author_id: me, body: r.body, created_at: iso(r.createdAt) })
  }

  const myShops = new Set<ID>()
  for (const x of s.shops) {
    if (x.ownerId !== me) continue
    myShops.add(x.id)
    put('shops', { id: x.id, owner_id: me, name: x.name, category: x.category, description: x.description, image: x.image, created_at: iso(x.createdAt) })
  }
  for (const p of s.products) {
    if (!myShops.has(p.shopId)) continue
    put('products', { id: p.id, shop_id: p.shopId, title: p.title, description: p.description, price: p.price, image: p.image, category: p.category, stripe_link: nul(p.stripeLink), ships: !!p.ships, created_at: iso(p.createdAt) })
  }
  for (const o of s.orders) if (o.buyerId === me) put('orders', { id: o.id, product_id: o.productId, buyer_id: me, via: o.via, created_at: iso(o.createdAt) })

  for (const o of s.opportunities) {
    if (o.postedById !== me) continue
    put('opportunities', {
      id: o.id,
      posted_by: me,
      title: o.title,
      org: o.org,
      icon: o.icon,
      icon_tone: o.iconTone,
      location: o.location,
      type: o.type,
      kind: o.kind,
      tags: o.tags,
      pay: o.pay,
      description: o.description,
      paid_via: nul(o.paidVia),
      created_at: iso(o.createdAt),
    })
  }
  for (const a of s.applications) if (a.applicantId === me) put('applications', { id: a.id, opportunity_id: a.opportunityId, applicant_id: me, message: a.message, link: nul(a.link), created_at: iso(a.createdAt) })

  for (const t of s.threads) {
    if (!t.participantIds.includes(me)) continue
    const starter = t.participantIds[0]
    if (starter === me) put('threads', { id: t.id, created_by: me, context: t.context ?? null })
    put('thread_participants', { thread_id: t.id, user_id: me, read_at: iso(t.readAt) })
    // Whoever starts a conversation adds the others (keys only: their read state is theirs).
    if (starter === me) for (const u of t.participantIds) if (u !== me) put('thread_participants', { thread_id: t.id, user_id: u })
    for (const m of t.messages) if (m.senderId === me) put('messages', { id: m.id, thread_id: t.id, sender_id: me, body: m.body, created_at: iso(m.createdAt) })
  }

  for (const n of s.notifications[me] ?? []) put('notifications', { id: n.id, read: n.read })

  for (const a of s.ads ?? []) {
    if (a.ownerId !== me) continue
    put('ads', { id: a.id, owner_id: me, business: a.business, headline: a.headline, image: a.image, url: a.url, district: a.district, plan: a.plan, via: a.via, created_at: iso(a.createdAt) })
  }

  for (const w of s.workrooms ?? []) {
    if (!w.memberIds.includes(me)) continue
    if (w.ownerId === me) put('workrooms', { id: w.id, name: w.name, owner_id: me, contract_id: nul(w.contractId), created_at: iso(w.createdAt) })
    for (const u of w.memberIds) put('workroom_members', u === me ? { workroom_id: w.id, user_id: me, read_at: iso(w.readAt[me] ?? w.createdAt) } : { workroom_id: w.id, user_id: u })
    for (const c of w.channels) put('workroom_channels', { id: c.id, workroom_id: w.id, name: c.name })
    for (const m of w.messages) if (m.senderId === me) put('workroom_messages', { id: m.id, workroom_id: w.id, channel_id: m.channelId, sender_id: me, body: m.body, created_at: iso(m.createdAt) })
  }

  for (const c of s.contracts ?? []) {
    if (c.employerId !== me && c.workerId !== me) continue
    if (c.employerId === me) {
      put('contracts', { id: c.id, title: c.title, opportunity_id: nul(c.opportunityId), employer_id: me, worker_id: c.workerId, rate: c.rate, status: c.status, workroom_id: c.workroomId || null, created_at: iso(c.createdAt) })
    }
    for (const i of c.invoices) {
      put('invoices', { id: i.id, contract_id: c.id, amount: i.amount, description: i.description, pay_link: nul(i.payLink), status: i.status, created_at: iso(i.createdAt), paid_at: i.paidAt ? iso(i.paidAt) : null })
    }
  }

  return out
}
