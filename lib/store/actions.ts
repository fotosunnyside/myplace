/**
 * Pure world-state transitions. Every function takes the current state (plus args) and
 * returns the next state — no side effects — so they are trivially testable and map
 * one-to-one onto future backend mutations.
 */
import type {
  Account,
  Collection,
  Comment,
  Contract,
  DistrictId,
  ID,
  MemberPlan,
  Notification,
  Opportunity,
  PlanKind,
  Post,
  Product,
  Ref,
  Shop,
  Thread,
  WorldState,
  Workroom,
} from '@/lib/types'
import { COURSE_FEE_RATE } from '@/lib/config'

export const uid = (prefix = 'id') =>
  `${prefix}_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`

export class ActionError extends Error {}

const need = (s: WorldState): ID => {
  if (!s.accountId) throw new ActionError('Please sign in first.')
  return s.accountId
}

const toggle = (list: ID[], id: ID) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

const notify = (s: WorldState, userId: ID, n: Omit<Notification, 'id' | 'read' | 'createdAt'>, now: number): WorldState => {
  if (!s.accounts.some((a) => a.id === userId)) return s // only local accounts receive notifications on this device
  const list = s.notifications[userId] ?? []
  return { ...s, notifications: { ...s.notifications, [userId]: [{ ...n, id: uid('ntf'), read: false, createdAt: now }, ...list].slice(0, 100) } }
}

/* ------------------------------------------------------------------ */
/* Accounts                                                             */
/* ------------------------------------------------------------------ */

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export interface SignUpInput {
  name: string
  username: string
  email: string
  avatar?: string
  location?: string
  bio?: string
  interests?: string[]
}

export function signUp(s: WorldState, input: SignUpInput, now: number): WorldState {
  const username = input.username.trim().toLowerCase()
  const email = input.email.trim().toLowerCase()
  if (!input.name.trim()) throw new ActionError('Please add your name.')
  if (!USERNAME_RE.test(username)) throw new ActionError('Usernames are 3–20 characters: lowercase letters, numbers and _.')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ActionError('Please enter a valid email address.')
  if ([...s.people, ...s.accounts].some((p) => p.username === username)) throw new ActionError('That username is taken.')
  if (s.accounts.some((a) => a.email === email)) throw new ActionError('An account with this email already exists on this device. Sign in instead.')

  const account: Account = {
    id: uid('acc'),
    name: input.name.trim(),
    username,
    email,
    avatar: input.avatar || '',
    bio: input.bio?.trim() ?? '',
    location: input.location?.trim() ?? '',
    headline: '',
    interests: input.interests ?? [],
    skills: [],
    openTo: [],
    joinedAt: now,
  }
  let next: WorldState = { ...s, accounts: [...s.accounts, account], accountId: account.id }
  const welcome: Thread = {
    id: uid('thr'),
    participantIds: [account.id, 'p_guide'],
    readAt: 0,
    messages: [
      {
        id: uid('msg'),
        senderId: 'p_guide',
        createdAt: now,
        body: `Welcome to PLACES FOR US, ${account.name}! Your profile lives in YourPlace. Take a course in MindPlace, open a shop in MarketPlace, or find work in WorkPlace — it's all one identity.`,
      },
    ],
  }
  next = { ...next, threads: [welcome, ...next.threads] }
  return notify(next, account.id, { text: 'Welcome to PLACES FOR US — your home is ready in YourPlace.', href: '/yourplace', district: 'yourplace' }, now)
}

export function signIn(s: WorldState, email: string): WorldState {
  const acc = s.accounts.find((a) => a.email === email.trim().toLowerCase())
  if (!acc) throw new ActionError('No account with that email on this device yet. Create one to get started.')
  return { ...s, accountId: acc.id }
}

export const signOut = (s: WorldState): WorldState => ({ ...s, accountId: null })

export type ProfilePatch = Partial<Pick<Account, 'name' | 'avatar' | 'bio' | 'location' | 'headline' | 'website' | 'interests' | 'skills' | 'openTo'>>

/** A website as typed ("mystudio.com") → a full link, or undefined when empty. Mirrors profiles_website_check. */
export function normalizeWebsite(raw: string | undefined): string | undefined {
  const v = raw?.trim()
  if (!v) return undefined
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`
  if (url.length > 200 || !/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(url) || !/\.[a-z]{2,}/i.test(url)) throw new ActionError('That website doesn’t look right — try something like mystudio.com.')
  return url
}

export function updateProfile(s: WorldState, patch: ProfilePatch): WorldState {
  const me = need(s)
  if (patch.name !== undefined && !patch.name.trim()) throw new ActionError('Your name cannot be empty.')
  const next = 'website' in patch ? { ...patch, website: normalizeWebsite(patch.website) } : patch
  return { ...s, accounts: s.accounts.map((a) => (a.id === me ? { ...a, ...next } : a)) }
}

/** Removes the account and everything it created on this device. */
export function deleteAccount(s: WorldState): WorldState {
  const me = need(s)
  const myShops = new Set(s.shops.filter((x) => x.ownerId === me).map((x) => x.id))
  const omit = <T,>(r: Record<ID, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== me))
  return {
    ...s,
    accountId: null,
    accounts: s.accounts.filter((a) => a.id !== me),
    posts: s.posts
      .filter((p) => p.authorId !== me)
      .map((p) => ({ ...p, likes: p.likes.filter((x) => x !== me), comments: p.comments.filter((c) => c.authorId !== me), poll: p.poll?.map((o) => ({ ...o, votes: o.votes.filter((v) => v !== me) })) })),
    discussions: s.discussions
      .filter((d) => d.authorId !== me)
      .map((d) => ({ ...d, upvoters: d.upvoters.filter((x) => x !== me), replies: d.replies.filter((r) => r.authorId !== me) })),
    shops: s.shops.filter((x) => x.ownerId !== me),
    products: s.products.filter((p) => !myShops.has(p.shopId)),
    orders: s.orders.filter((o) => o.buyerId !== me),
    courses: s.courses.filter((c) => c.expertId !== me),
    coursePurchases: (s.coursePurchases ?? []).filter((p) => p.buyerId !== me),
    opportunities: s.opportunities.filter((o) => o.postedById !== me),
    applications: s.applications.filter((a) => a.applicantId !== me),
    ads: (s.ads ?? []).filter((a) => a.ownerId !== me),
    contracts: (s.contracts ?? []).filter((c) => c.employerId !== me && c.workerId !== me),
    workrooms: (s.workrooms ?? []).filter((w) => w.ownerId !== me).map((w) => ({ ...w, memberIds: w.memberIds.filter((m) => m !== me) })),
    threads: s.threads.filter((t) => !t.participantIds.includes(me)),
    following: Object.fromEntries(Object.entries(omit(s.following)).map(([k, v]) => [k, v.filter((x) => x !== me)])),
    enrollments: omit(s.enrollments),
    saved: omit(s.saved),
    collections: omit(s.collections),
    notifications: omit(s.notifications),
  }
}

export const toggleFollow = (s: WorldState, personId: ID): WorldState => {
  const me = need(s)
  if (personId === me) return s
  return { ...s, following: { ...s.following, [me]: toggle(s.following[me] ?? [], personId) } }
}

/* ------------------------------------------------------------------ */
/* YourPlace                                                            */
/* ------------------------------------------------------------------ */

export interface PostInput {
  body: string
  image?: string
  link?: string
  location?: string
  pollOptions?: string[]
  audience?: Post['audience']
}

export function createPost(s: WorldState, input: PostInput, now: number): WorldState {
  const me = need(s)
  const body = input.body.trim()
  const options = (input.pollOptions ?? []).map((o) => o.trim()).filter(Boolean)
  if (!body && !input.image) throw new ActionError('Write something or add a photo.')
  if (input.pollOptions && options.length < 2) throw new ActionError('A poll needs at least two options.')
  if (input.link && !/^https?:\/\//i.test(input.link.trim())) throw new ActionError('Links should start with http:// or https://')
  const post: Post = {
    id: uid('post'),
    authorId: me,
    body,
    image: input.image,
    link: input.link?.trim() || undefined,
    location: input.location?.trim() || undefined,
    poll: options.length ? options.map((label) => ({ id: uid('opt'), label, votes: [] })) : undefined,
    audience: input.audience ?? 'public',
    createdAt: now,
    likes: [],
    comments: [],
  }
  return { ...s, posts: [post, ...s.posts] }
}

export function deletePost(s: WorldState, postId: ID): WorldState {
  const me = need(s)
  return { ...s, posts: s.posts.filter((p) => !(p.id === postId && p.authorId === me)) }
}

export function toggleLike(s: WorldState, postId: ID): WorldState {
  const me = need(s)
  return { ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, likes: toggle(p.likes, me) } : p)) }
}

export function addComment(s: WorldState, postId: ID, body: string, now: number): WorldState {
  const me = need(s)
  if (!body.trim()) throw new ActionError('Write a comment first.')
  const c: Comment = { id: uid('cmt'), authorId: me, body: body.trim(), createdAt: now }
  const post = s.posts.find((p) => p.id === postId)
  let next = { ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, c] } : p)) }
  if (post && post.authorId !== me) next = notify(next, post.authorId, { text: 'Someone commented on your post.', href: '/yourplace', district: 'yourplace' }, now)
  return next
}

export function votePoll(s: WorldState, postId: ID, optionId: ID): WorldState {
  const me = need(s)
  return {
    ...s,
    posts: s.posts.map((p) =>
      p.id === postId && p.poll
        ? {
            ...p,
            // single choice: tapping your current choice clears it
            poll: p.poll.map((o) => {
              const without = o.votes.filter((v) => v !== me)
              if (o.id !== optionId) return { ...o, votes: without }
              return { ...o, votes: o.votes.includes(me) ? without : [...without, me] }
            }),
          }
        : p,
    ),
  }
}

/* ------------------------------------------------------------------ */
/* Saved & collections                                                  */
/* ------------------------------------------------------------------ */

export const isSaved = (s: WorldState, ref: Ref) => !!s.accountId && (s.saved[s.accountId] ?? []).some((x) => x.kind === ref.kind && x.refId === ref.refId)

export function toggleSave(s: WorldState, ref: Ref, now: number): WorldState {
  const me = need(s)
  const list = s.saved[me] ?? []
  const exists = list.some((x) => x.kind === ref.kind && x.refId === ref.refId)
  return {
    ...s,
    saved: { ...s.saved, [me]: exists ? list.filter((x) => !(x.kind === ref.kind && x.refId === ref.refId)) : [{ ...ref, savedAt: now }, ...list] },
  }
}

export function createCollection(s: WorldState, title: string, now: number): WorldState {
  const me = need(s)
  if (!title.trim()) throw new ActionError('Give your collection a name.')
  const c: Collection = { id: uid('col'), title: title.trim(), items: [], createdAt: now }
  return { ...s, collections: { ...s.collections, [me]: [c, ...(s.collections[me] ?? [])] } }
}

export function toggleInCollection(s: WorldState, collectionId: ID, ref: Ref): WorldState {
  const me = need(s)
  return {
    ...s,
    collections: {
      ...s.collections,
      [me]: (s.collections[me] ?? []).map((c) => {
        if (c.id !== collectionId) return c
        const has = c.items.some((i) => i.kind === ref.kind && i.refId === ref.refId)
        return { ...c, items: has ? c.items.filter((i) => !(i.kind === ref.kind && i.refId === ref.refId)) : [...c.items, ref] }
      }),
    },
  }
}

export function deleteCollection(s: WorldState, collectionId: ID): WorldState {
  const me = need(s)
  return { ...s, collections: { ...s.collections, [me]: (s.collections[me] ?? []).filter((c) => c.id !== collectionId) } }
}

/* ------------------------------------------------------------------ */
/* MindPlace                                                            */
/* ------------------------------------------------------------------ */

export function enroll(s: WorldState, courseId: ID, now: number): WorldState {
  const me = need(s)
  const list = s.enrollments[me] ?? []
  if (list.some((e) => e.courseId === courseId)) return s
  const course = s.courses.find((c) => c.id === courseId)
  if (course && !canAccessCourse(s, courseId, me)) throw new ActionError(`Buy ${course.title} to start learning.`)
  return { ...s, enrollments: { ...s.enrollments, [me]: [...list, { courseId, startedAt: now, completed: [] }] } }
}

export function toggleLesson(s: WorldState, courseId: ID, lessonId: ID, now: number): WorldState {
  const me = need(s)
  let next = enroll(s, courseId, now)
  const course = next.courses.find((c) => c.id === courseId)
  let finished = false
  next = {
    ...next,
    enrollments: {
      ...next.enrollments,
      [me]: next.enrollments[me].map((e) => {
        if (e.courseId !== courseId) return e
        const completed = toggle(e.completed, lessonId)
        finished = !!course && completed.length === course.lessons.length && !e.completed.includes(lessonId)
        return { ...e, completed }
      }),
    },
  }
  if (finished && course) next = notify(next, me, { text: `You completed ${course.title}. Beautiful work!`, href: `/mindplace/course/?id=${course.id}`, district: 'mindplace' }, now)
  return next
}

export interface DiscussionInput {
  title: string
  body: string
  category: string
}

const categoryTone: Record<string, WorldState['discussions'][number]['tone']> = {
  WorkPlace: 'teal', MarketPlace: 'coral', Travel: 'sun', Growth: 'lavender', Gardening: 'leaf', Sustainability: 'leaf', Wellness: 'lavender', Careers: 'teal', Creativity: 'coral', General: 'sky',
}
export const DISCUSSION_CATEGORIES = Object.keys(categoryTone)

export function createDiscussion(s: WorldState, input: DiscussionInput, now: number): { state: WorldState; id: ID } {
  const me = need(s)
  if (input.title.trim().length < 6) throw new ActionError('Give your discussion a clear title (at least 6 characters).')
  const id = uid('dsc')
  const d = { id, title: input.title.trim(), body: input.body.trim(), authorId: me, category: input.category, tone: categoryTone[input.category] ?? 'sky', createdAt: now, upvoters: [], replies: [] }
  return { state: { ...s, discussions: [d, ...s.discussions] }, id }
}

export function toggleUpvote(s: WorldState, discussionId: ID): WorldState {
  const me = need(s)
  return { ...s, discussions: s.discussions.map((d) => (d.id === discussionId ? { ...d, upvoters: toggle(d.upvoters, me) } : d)) }
}

export function replyToDiscussion(s: WorldState, discussionId: ID, body: string, now: number): WorldState {
  const me = need(s)
  if (!body.trim()) throw new ActionError('Write a reply first.')
  const d = s.discussions.find((x) => x.id === discussionId)
  let next = { ...s, discussions: s.discussions.map((x) => (x.id === discussionId ? { ...x, replies: [...x.replies, { id: uid('rep'), authorId: me, body: body.trim(), createdAt: now }] } : x)) }
  if (d && d.authorId !== me) next = notify(next, d.authorId, { text: `New reply on “${d.title}”.`, href: `/mindplace/discussion/?id=${d.id}`, district: 'mindplace' }, now)
  return next
}

/* ------------------------------------------------------------------ */
/* MarketPlace                                                          */
/* ------------------------------------------------------------------ */

/** PLACES platform fee on shipped (physical) items. Local sales and listings are free; PLACES Pass doesn't remove it. */
export const SALES_FEE_RATE = 0.01

export const STRIPE_LINK_RE = /^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com|donate\.stripe\.com)\//

export function createShop(s: WorldState, input: Pick<Shop, 'name' | 'category' | 'description' | 'image'>, now: number): { state: WorldState; id: ID } {
  const me = need(s)
  if (s.shops.some((x) => x.ownerId === me)) throw new ActionError('You already have a shop.')
  if (!input.name.trim()) throw new ActionError('Name your shop.')
  const id = uid('shp')
  return { state: { ...s, shops: [...s.shops, { ...input, name: input.name.trim(), id, ownerId: me, createdAt: now }] }, id }
}

export type ProductInput = Pick<Product, 'title' | 'description' | 'price' | 'image' | 'category'> & { stripeLink?: string; ships?: boolean }

export function createProduct(s: WorldState, input: ProductInput, now: number): { state: WorldState; id: ID } {
  const me = need(s)
  const shop = s.shops.find((x) => x.ownerId === me)
  if (!shop) throw new ActionError('Open your shop first.')
  if (!input.title.trim()) throw new ActionError('Give your product a name.')
  if (!Number.isFinite(input.price) || input.price < 50) throw new ActionError('Set a price of at least $0.50.')
  if (!input.image) throw new ActionError('Add a product photo.')
  const link = input.stripeLink?.trim()
  if (link && !STRIPE_LINK_RE.test(link)) throw new ActionError('Paste a Stripe Payment Link (it starts with https://buy.stripe.com/).')
  const id = uid('prd')
  return { state: { ...s, products: [{ ...input, title: input.title.trim(), stripeLink: link || undefined, id, shopId: shop.id, createdAt: now }, ...s.products] }, id }
}

export function updateProduct(s: WorldState, productId: ID, patch: Partial<ProductInput>): WorldState {
  const me = need(s)
  const myShop = s.shops.find((x) => x.ownerId === me)
  if (patch.stripeLink && !STRIPE_LINK_RE.test(patch.stripeLink.trim())) throw new ActionError('Paste a Stripe Payment Link (it starts with https://buy.stripe.com/).')
  return { ...s, products: s.products.map((p) => (p.id === productId && p.shopId === myShop?.id ? { ...p, ...patch } : p)) }
}

export function deleteProduct(s: WorldState, productId: ID): WorldState {
  const me = need(s)
  const myShop = s.shops.find((x) => x.ownerId === me)
  return { ...s, products: s.products.filter((p) => !(p.id === productId && p.shopId === myShop?.id)) }
}

/** Records an order. `via: 'stripe'` once the buyer returns from the seller's Payment Link. */
export function placeOrder(s: WorldState, productId: ID, via: 'stripe' | 'test', now: number): WorldState {
  const me = need(s)
  const p = s.products.find((x) => x.id === productId)
  if (!p) throw new ActionError('That product is no longer available.')
  const shop = s.shops.find((x) => x.id === p.shopId)
  const fee = p.ships ? Math.round(p.price * SALES_FEE_RATE) : 0
  let next: WorldState = { ...s, orders: [{ id: uid('ord'), productId, buyerId: me, total: p.price, fee: fee || undefined, via, createdAt: now }, ...s.orders] }
  next = notify(next, me, { text: `Order confirmed: ${p.title}.`, href: '/activity', district: 'marketplace' }, now)
  if (shop) next = notify(next, shop.ownerId, { text: `New order for ${p.title}!`, href: '/activity', district: 'marketplace' }, now)
  return next
}

/* ------------------------------------------------------------------ */
/* WorkPlace                                                            */
/* ------------------------------------------------------------------ */

export type OpportunityInput = Pick<Opportunity, 'title' | 'org' | 'location' | 'type' | 'kind' | 'tags' | 'pay' | 'description'>

const kindIcon: Record<Opportunity['kind'], Pick<Opportunity, 'icon' | 'iconTone'>> = {
  job: { icon: 'briefcase', iconTone: 'teal' },
  service: { icon: 'palette', iconTone: 'lavender' },
  project: { icon: 'waves', iconTone: 'sky' },
  team: { icon: 'megaphone', iconTone: 'coral' },
}

/** Throws if a post isn't ready — checked before sending someone to pay the posting fee. */
export function checkOpportunity(input: OpportunityInput) {
  if (input.title.trim().length < 4) throw new ActionError('Add a title.')
  if (input.description.trim().length < 20) throw new ActionError('Describe the opportunity in at least a sentence or two.')
}

/** `paidVia: 'pass'` — included with PLACES Pass instead of the $2 posting fee. */
export function createOpportunity(s: WorldState, input: OpportunityInput, now: number, paidVia: 'stripe' | 'test' | 'pass' = 'test'): { state: WorldState; id: ID } {
  const me = need(s)
  if (paidVia === 'pass' && !hasPass(s, me)) throw new ActionError('Posting is included with PLACES Pass. Start the Pass or pay the posting fee.')
  checkOpportunity(input)
  const id = uid('opp')
  return { state: { ...s, opportunities: [{ ...input, ...kindIcon[input.kind], title: input.title.trim(), id, postedById: me, createdAt: now, paidVia }, ...s.opportunities] }, id }
}

export function deleteOpportunity(s: WorldState, id: ID): WorldState {
  const me = need(s)
  return { ...s, opportunities: s.opportunities.filter((o) => !(o.id === id && o.postedById === me)) }
}

export function apply(s: WorldState, opportunityId: ID, message: string, link: string | undefined, now: number): WorldState {
  const me = need(s)
  if (s.applications.some((a) => a.opportunityId === opportunityId && a.applicantId === me)) throw new ActionError('You already applied.')
  if (message.trim().length < 20) throw new ActionError('Write a short note (at least 20 characters) about why you’re a great fit.')
  const o = s.opportunities.find((x) => x.id === opportunityId)
  if (!o) throw new ActionError('This opportunity is no longer open.')
  let next: WorldState = { ...s, applications: [{ id: uid('app'), opportunityId, applicantId: me, message: message.trim(), link: link?.trim() || undefined, createdAt: now }, ...s.applications] }
  next = notify(next, me, { text: `Application sent: ${o.title} at ${o.org}.`, href: '/activity', district: 'workplace' }, now)
  next = notify(next, o.postedById, { text: `New applicant for ${o.title}.`, href: '/activity', district: 'workplace' }, now)
  return next
}

/* ------------------------------------------------------------------ */
/* Messages & notifications                                             */
/* ------------------------------------------------------------------ */

export function openThread(s: WorldState, otherId: ID, context: Thread['context'] | undefined, now: number): { state: WorldState; id: ID } {
  const me = need(s)
  if (otherId === me) throw new ActionError('That’s you!')
  const existing = s.threads.find(
    (t) => t.participantIds.includes(me) && t.participantIds.includes(otherId) && (context ? t.context?.refId === context.refId : !t.context),
  )
  if (existing) return { state: s, id: existing.id }
  const t: Thread = { id: uid('thr'), participantIds: [me, otherId], messages: [], context, readAt: now }
  return { state: { ...s, threads: [t, ...s.threads] }, id: t.id }
}

export function sendMessage(s: WorldState, threadId: ID, body: string, now: number): WorldState {
  const me = need(s)
  if (!body.trim()) return s
  const thread = s.threads.find((t) => t.id === threadId)
  if (!thread || !thread.participantIds.includes(me)) throw new ActionError('Conversation not found.')
  const updated = { ...thread, messages: [...thread.messages, { id: uid('msg'), senderId: me, body: body.trim(), createdAt: now }], readAt: now }
  let next: WorldState = { ...s, threads: [updated, ...s.threads.filter((t) => t.id !== threadId)] }
  for (const other of thread.participantIds.filter((p) => p !== me)) {
    next = notify(next, other, { text: 'You have a new message.', href: `/messages/?t=${threadId}`, district: 'yourplace' }, now)
  }
  return next
}

export const markThreadRead = (s: WorldState, threadId: ID, now: number): WorldState => ({
  ...s,
  threads: s.threads.map((t) => (t.id === threadId ? { ...t, readAt: now } : t)),
})

export function markAllNotificationsRead(s: WorldState): WorldState {
  const me = need(s)
  return { ...s, notifications: { ...s.notifications, [me]: (s.notifications[me] ?? []).map((n) => ({ ...n, read: true })) } }
}

export const districtOf = (kind: Ref['kind']): DistrictId =>
  kind === 'course' || kind === 'discussion' ? 'mindplace' : kind === 'product' || kind === 'shop' ? 'marketplace' : kind === 'opportunity' ? 'workplace' : 'yourplace'

/* ------------------------------------------------------------------ */
/* Creators — publish courses in MindPlace                              */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000

/** An active plan of this kind. The old creator plan (on-device worlds from before PLACES Pass) counts as Create. */
export function activePlan(s: WorldState, kind: PlanKind, id: ID | null = s.accountId): MemberPlan | undefined {
  const p = s.accounts.find((a) => a.id === id) ?? s.people.find((x) => x.id === id)
  const plan = p?.plans?.[kind]
  if (plan?.status === 'active') return plan
  if (kind === 'create' && p?.creatorPlan?.status === 'active') return { ...p.creatorPlan, quantity: Math.max(1, s.courses.filter((c) => c.expertId === id).length) }
  return undefined
}

export const hasPass = (s: WorldState, id: ID | null = s.accountId) => !!activePlan(s, 'pass', id)

/** Publishing in MindPlace: with the Pass, or Create (per course or membership). */
export const hasCreatorPlan = (s: WorldState, id: ID | null = s.accountId) => hasPass(s, id) || !!activePlan(s, 'create', id)

/** Hosting one's own virtual spaces: Host a Space, or the Pass. */
export const canHostSpaces = (s: WorldState, id: ID | null = s.accountId) => hasPass(s, id) || !!activePlan(s, 'host', id)

/** How many more courses or memberships someone may publish (mirrors public.course_slots()). */
export function courseSlotsLeft(s: WorldState, id: ID | null = s.accountId) {
  if (hasPass(s, id)) return Infinity
  const create = activePlan(s, 'create', id)
  return Math.max(0, (create?.quantity ?? 0) - s.courses.filter((c) => c.expertId === id).length)
}

/** The PLACES platform fee on a paid enrollment or membership payment (mirrors public.fill_course_purchase()). */
export const courseFee = (s: WorldState, expertId: ID, total: number) => (total > 0 && !hasPass(s, expertId) ? Math.round(total * COURSE_FEE_RATE) : 0)

/** Free courses, the author, and buyers can open every lesson. */
export function canAccessCourse(s: WorldState, courseId: ID, userId: ID | null = s.accountId) {
  const c = s.courses.find((x) => x.id === courseId)
  if (!c) return false
  if (!c.price) return true
  if (!userId) return false
  return c.expertId === userId || (s.coursePurchases ?? []).some((p) => p.courseId === courseId && p.buyerId === userId)
}

const PLAN_WELCOME: Record<PlanKind, { text: string; href: string; district: DistrictId }> = {
  pass: { text: 'Your PLACES Pass is active. Create, teach and host across PLACES.', href: '/pricing', district: 'mindplace' },
  host: { text: 'You can create your own Virtual Places now. Open your first one!', href: '/yourplace/?tab=places', district: 'yourplace' },
  create: { text: 'Create in MindPlace is active. Publish your course or membership!', href: '/teach', district: 'mindplace' },
}

/**
 * Starts (or renews) a plan. Starting Create again while it's active adds one more course or membership to it —
 * Create is priced per published course.
 */
export function startPlan(s: WorldState, kind: PlanKind, via: 'stripe' | 'test', now: number): WorldState {
  const me = need(s)
  const current = activePlan(s, kind, me)
  const account = s.accounts.find((a) => a.id === me)
  const stored = account?.plans?.[kind]
  const quantity = kind === 'create' && current ? Math.min(50, current.quantity + 1) : 1
  const plan: MemberPlan = { status: 'active', via, since: current?.since ?? stored?.since ?? now, renewsAt: now + 30 * DAY, quantity }
  const next = { ...s, accounts: s.accounts.map((a) => (a.id === me ? { ...a, plans: { ...a.plans, [kind]: plan } } : a)) }
  return current && kind !== 'create' ? next : notify(next, me, PLAN_WELCOME[kind], now)
}

export function cancelPlan(s: WorldState, kind: PlanKind): WorldState {
  const me = need(s)
  return {
    ...s,
    accounts: s.accounts.map((a) => {
      if (a.id !== me) return a
      const plans = a.plans?.[kind] ? { ...a.plans, [kind]: { ...a.plans[kind]!, status: 'canceled' as const } } : a.plans
      // An old on-device creator plan is Create.
      const creatorPlan = kind === 'create' && a.creatorPlan ? { ...a.creatorPlan, status: 'canceled' as const } : a.creatorPlan
      return { ...a, plans, creatorPlan }
    }),
  }
}

export interface LessonInput {
  id?: ID
  title: string
  minutes: number
  body: string
}

export interface CourseInput {
  title: string
  subtitle: string
  description: string
  image: string
  topic: string
  kind: 'course' | 'guide'
  /** Cents; 0 = free. */
  price: number
  /** Paid: one-time enrollment, or a recurring monthly membership. */
  billing?: 'once' | 'monthly'
  stripeLink?: string
  lessons: LessonInput[]
}

function validateCourse(input: CourseInput) {
  if (input.title.trim().length < 3) throw new ActionError('Give your course a title.')
  if (!input.image) throw new ActionError('Add a cover image.')
  const lessons = input.lessons.filter((l) => l.title.trim() || l.body.trim())
  if (!lessons.length) throw new ActionError('Add at least one lesson.')
  if (lessons.some((l) => !l.title.trim() || !l.body.trim())) throw new ActionError('Every lesson needs a title and some content.')
  if (input.price && input.price < 100) throw new ActionError('Paid courses cost at least $1.')
  const link = input.stripeLink?.trim()
  if (link && !STRIPE_LINK_RE.test(link)) throw new ActionError('Paste a Stripe Payment Link (it starts with https://buy.stripe.com/).')
  return lessons
}

const toLessons = (lessons: LessonInput[]) =>
  lessons.map((l) => ({ id: l.id ?? uid('lsn'), title: l.title.trim(), minutes: Math.max(1, Math.round(l.minutes || 5)), body: l.body.trim() }))

export function createCourse(s: WorldState, input: CourseInput, now: number): { state: WorldState; id: ID } {
  const me = need(s)
  if (courseSlotsLeft(s, me) < 1)
    throw new ActionError(hasCreatorPlan(s, me) ? 'Add another course to Create in MindPlace, or use PLACES Pass to publish more.' : 'Choose Create in MindPlace or PLACES Pass to publish.')
  const lessons = validateCourse(input)
  const id = uid('crs')
  const course = {
    id,
    title: input.title.trim(),
    subtitle: input.subtitle.trim() || (input.price ? 'Premium course' : 'Free course'),
    description: input.description.trim(),
    image: input.image,
    kind: input.kind,
    topic: input.topic,
    expertId: me,
    lessons: toLessons(lessons),
    baseMembers: 0,
    price: input.price || undefined,
    billing: input.price && input.billing === 'monthly' ? ('monthly' as const) : undefined,
    stripeLink: input.stripeLink?.trim() || undefined,
    createdAt: now,
  }
  return { state: { ...s, courses: [course, ...s.courses] }, id }
}

export function updateCourse(s: WorldState, courseId: ID, input: CourseInput): WorldState {
  const me = need(s)
  const c = s.courses.find((x) => x.id === courseId)
  if (!c || c.expertId !== me) throw new ActionError('You can only edit your own courses.')
  const lessons = validateCourse(input)
  return {
    ...s,
    courses: s.courses.map((x) =>
      x.id === courseId
        ? {
            ...x,
            title: input.title.trim(),
            subtitle: input.subtitle.trim() || x.subtitle,
            description: input.description.trim(),
            image: input.image,
            kind: input.kind,
            topic: input.topic,
            lessons: toLessons(lessons),
            price: input.price || undefined,
            billing: input.price && input.billing === 'monthly' ? ('monthly' as const) : undefined,
            stripeLink: input.stripeLink?.trim() || undefined,
          }
        : x,
    ),
  }
}

export function deleteCourse(s: WorldState, courseId: ID): WorldState {
  const me = need(s)
  return { ...s, courses: s.courses.filter((c) => !(c.id === courseId && c.expertId === me)) }
}

/** Records a purchase (after the creator's Stripe checkout, or a test purchase) and enrolls the buyer. */
export function purchaseCourse(s: WorldState, courseId: ID, via: 'stripe' | 'test', now: number): WorldState {
  const me = need(s)
  const c = s.courses.find((x) => x.id === courseId)
  if (!c) throw new ActionError('That course is no longer available.')
  if (canAccessCourse(s, courseId, me)) return enroll(s, courseId, now)
  const total = c.price ?? 0
  const fee = courseFee(s, c.expertId, total)
  let next: WorldState = { ...s, coursePurchases: [{ id: uid('cpu'), courseId, buyerId: me, total, fee: fee || undefined, via, createdAt: now }, ...(s.coursePurchases ?? [])] }
  next = enroll(next, courseId, now)
  next = notify(next, me, { text: `You now have ${c.title}. Enjoy!`, href: `/mindplace/course/?id=${c.id}`, district: 'mindplace' }, now)
  return notify(next, c.expertId, { text: `Someone bought your course ${c.title}!`, href: '/teach', district: 'mindplace' }, now)
}

/** Courses shown in MindPlace: seed courses plus courses from creators publishing with Create or the Pass. */
export function isListed(s: WorldState, courseId: ID) {
  const c = s.courses.find((x) => x.id === courseId)
  if (!c) return false
  // PLACES community courses are always listed; members' courses while they publish with Create or the Pass.
  const isMember = s.accounts.some((a) => a.id === c.expertId) || s.people.some((p) => p.id === c.expertId && p.member)
  return !isMember || hasCreatorPlan(s, c.expertId)
}

/* ------------------------------------------------------------------ */
/* Ads — one sponsored mini banner per Place                            */
/* ------------------------------------------------------------------ */

/** $10 a week; the longer booking is 4 weeks (public.schedule_ad()). */
export const AD_DAYS = { week: 7, month: 28 } as const

export interface AdInput {
  business: string
  headline: string
  image: string
  url: string
  district: DistrictId
  plan: 'week' | 'month'
}

export function checkAd(input: AdInput) {
  if (input.business.trim().length < 2) throw new ActionError('Add your business name.')
  if (input.headline.trim().length < 6) throw new ActionError('Write a short headline (at least 6 characters).')
  if (!/^https:\/\/\S+\.\S+/.test(input.url.trim())) throw new ActionError('Your link should start with https://')
  if (!input.image) throw new ActionError('Add an image for your banner.')
}

/** Books an ad. It starts when the Place's slot is free (after the last booking there ends). */
export function createAd(s: WorldState, input: AdInput, via: 'stripe' | 'test', now: number): { state: WorldState; id: ID } {
  const me = need(s)
  checkAd(input)
  const queueEnd = Math.max(now, ...(s.ads ?? []).filter((a) => a.district === input.district).map((a) => a.endsAt))
  const id = uid('ad')
  const ad = {
    id,
    ownerId: me,
    business: input.business.trim(),
    headline: input.headline.trim(),
    image: input.image,
    url: input.url.trim(),
    district: input.district,
    plan: input.plan,
    startsAt: queueEnd,
    endsAt: queueEnd + AD_DAYS[input.plan] * DAY,
    via,
    createdAt: now,
  }
  const next = { ...s, ads: [...(s.ads ?? []), ad] }
  return { state: notify(next, me, { text: `Your ad in ${input.district} is booked.`, href: '/advertise', district: input.district }, now), id }
}

export const activeAd = (s: WorldState, district: DistrictId, now: number) =>
  (s.ads ?? []).find((a) => a.district === district && a.startsAt <= now && now < a.endsAt)

export function cancelAd(s: WorldState, adId: ID): WorldState {
  const me = need(s)
  return { ...s, ads: (s.ads ?? []).filter((a) => !(a.id === adId && a.ownerId === me)) }
}

/* ------------------------------------------------------------------ */
/* Workrooms — the in-house chat for teams and hires                    */
/* ------------------------------------------------------------------ */

const room = (s: WorldState, id: ID) => (s.workrooms ?? []).find((w) => w.id === id)
const updateRoom = (s: WorldState, id: ID, fn: (w: Workroom) => Workroom): WorldState => ({ ...s, workrooms: (s.workrooms ?? []).map((w) => (w.id === id ? fn(w) : w)) })

function newRoom(name: string, ownerId: ID, memberIds: ID[], now: number, contractId?: ID): Workroom {
  return {
    id: uid('wrk'),
    name: name.trim(),
    ownerId,
    memberIds: [...new Set([ownerId, ...memberIds])],
    channels: [
      { id: uid('ch'), name: 'general' },
      { id: uid('ch'), name: 'updates' },
    ],
    messages: [],
    contractId,
    readAt: { [ownerId]: now },
    createdAt: now,
  }
}

export function createWorkroom(s: WorldState, name: string, now: number): { state: WorldState; id: ID } {
  const me = need(s)
  if (name.trim().length < 2) throw new ActionError('Name your workroom.')
  const w = newRoom(name, me, [], now)
  return { state: { ...s, workrooms: [w, ...(s.workrooms ?? [])] }, id: w.id }
}

export function addWorkroomMember(s: WorldState, workroomId: ID, username: string, now: number): WorldState {
  const me = need(s)
  const w = room(s, workroomId)
  if (!w || !w.memberIds.includes(me)) throw new ActionError('Workroom not found.')
  const u = username.trim().replace(/^@/, '').toLowerCase()
  const p = [...s.accounts, ...s.people].find((x) => x.username === u)
  if (!p) throw new ActionError(`No one with the username @${u}.`)
  if (w.memberIds.includes(p.id)) throw new ActionError(`${p.name} is already here.`)
  const next = updateRoom(s, workroomId, (x) => ({ ...x, memberIds: [...x.memberIds, p.id] }))
  return notify(next, p.id, { text: `You were added to the workroom “${w.name}”.`, href: `/workroom/?id=${w.id}`, district: 'workplace' }, now)
}

export function addChannel(s: WorldState, workroomId: ID, name: string): { state: WorldState; id: ID } {
  const me = need(s)
  const w = room(s, workroomId)
  if (!w || !w.memberIds.includes(me)) throw new ActionError('Workroom not found.')
  const clean = name.trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  if (!clean) throw new ActionError('Name the channel.')
  if (w.channels.some((c) => c.name === clean)) throw new ActionError(`#${clean} already exists.`)
  const id = uid('ch')
  return { state: updateRoom(s, workroomId, (x) => ({ ...x, channels: [...x.channels, { id, name: clean }] })), id }
}

export function postWorkMessage(s: WorldState, workroomId: ID, channelId: ID, body: string, now: number): WorldState {
  const me = need(s)
  const w = room(s, workroomId)
  if (!w || !w.memberIds.includes(me)) throw new ActionError('Workroom not found.')
  if (!body.trim()) return s
  const msg = { id: uid('wm'), channelId, senderId: me, body: body.trim(), createdAt: now }
  return updateRoom(s, workroomId, (x) => ({ ...x, messages: [...x.messages, msg], readAt: { ...x.readAt, [me]: now } }))
}

export function markWorkroomRead(s: WorldState, workroomId: ID, now: number): WorldState {
  const me = need(s)
  return updateRoom(s, workroomId, (x) => ({ ...x, readAt: { ...x.readAt, [me]: now } }))
}

/* ------------------------------------------------------------------ */
/* Hiring, contracts & invoices                                         */
/* ------------------------------------------------------------------ */

/** Employer hires an applicant: creates a contract and a shared workroom. */
export function hire(s: WorldState, applicationId: ID, now: number): { state: WorldState; id: ID } {
  const me = need(s)
  const app = s.applications.find((a) => a.id === applicationId)
  const opp = app && s.opportunities.find((o) => o.id === app.opportunityId)
  if (!app || !opp) throw new ActionError('Application not found.')
  if (opp.postedById !== me) throw new ActionError('Only the person who posted this can hire.')
  const existing = (s.contracts ?? []).find((c) => c.opportunityId === opp.id && c.workerId === app.applicantId)
  if (existing) return { state: s, id: existing.workroomId }
  const contractId = uid('ctr')
  const w = newRoom(opp.title, me, [app.applicantId], now, contractId)
  const worker = s.accounts.find((a) => a.id === app.applicantId) ?? s.people.find((p) => p.id === app.applicantId)
  w.messages.push({
    id: uid('wm'),
    channelId: w.channels[0].id,
    senderId: 'p_guide',
    body: `Welcome to your workroom for “${opp.title}”. ${worker?.name ?? 'Your new teammate'} was hired. Use #general to chat and #updates for progress. Invoices live in the contract panel.`,
    createdAt: now,
  })
  const contract = { id: contractId, title: opp.title, opportunityId: opp.id, employerId: me, workerId: app.applicantId, rate: opp.pay, status: 'active' as const, workroomId: w.id, invoices: [], createdAt: now }
  let next: WorldState = { ...s, contracts: [contract, ...(s.contracts ?? [])], workrooms: [w, ...(s.workrooms ?? [])] }
  next = notify(next, app.applicantId, { text: `You’re hired for ${opp.title}! Your workroom is ready.`, href: `/workroom/?id=${w.id}`, district: 'workplace' }, now)
  return { state: next, id: w.id }
}

const contractOf = (s: WorldState, id: ID) => (s.contracts ?? []).find((c) => c.id === id)
const updateContract = (s: WorldState, id: ID, fn: (c: Contract) => Contract): WorldState => ({ ...s, contracts: (s.contracts ?? []).map((c) => (c.id === id ? fn(c) : c)) })

export function addInvoice(s: WorldState, contractId: ID, input: { amount: number; description: string; payLink?: string }, now: number): WorldState {
  const me = need(s)
  const c = contractOf(s, contractId)
  if (!c || c.workerId !== me) throw new ActionError('Only the person hired can request payment.')
  if (c.status !== 'active') throw new ActionError('This contract is complete.')
  if (!Number.isFinite(input.amount) || input.amount < 100) throw new ActionError('Request at least $1.')
  if (!input.description.trim()) throw new ActionError('Describe what this payment is for.')
  const link = input.payLink?.trim()
  if (link && !/^https:\/\//.test(link)) throw new ActionError('Payment links should start with https://')
  const inv = { id: uid('inv'), amount: Math.round(input.amount), description: input.description.trim(), payLink: link || undefined, status: 'open' as const, createdAt: now }
  const next = updateContract(s, contractId, (x) => ({ ...x, invoices: [...x.invoices, inv] }))
  return notify(next, c.employerId, { text: `Payment requested for ${c.title}.`, href: `/workroom/?id=${c.workroomId}`, district: 'workplace' }, now)
}

export function markInvoicePaid(s: WorldState, contractId: ID, invoiceId: ID, now: number): WorldState {
  const me = need(s)
  const c = contractOf(s, contractId)
  if (!c || c.employerId !== me) throw new ActionError('Only the employer can mark payments as paid.')
  const next = updateContract(s, contractId, (x) => ({ ...x, invoices: x.invoices.map((i) => (i.id === invoiceId ? { ...i, status: 'paid' as const, paidAt: now } : i)) }))
  return notify(next, c.workerId, { text: `You were paid for ${c.title}.`, href: `/workroom/?id=${c.workroomId}`, district: 'workplace' }, now)
}

export function completeContract(s: WorldState, contractId: ID, now: number): WorldState {
  const me = need(s)
  const c = contractOf(s, contractId)
  if (!c || c.employerId !== me) throw new ActionError('Only the employer can complete the contract.')
  const next = updateContract(s, contractId, (x) => ({ ...x, status: 'completed' as const }))
  return notify(next, c.workerId, { text: `${c.title} is complete. Great work!`, href: `/workroom/?id=${c.workroomId}`, district: 'workplace' }, now)
}
