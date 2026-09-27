/**
 * Pure world-state transitions. Every function takes the current state (plus args) and
 * returns the next state — no side effects — so they are trivially testable and map
 * one-to-one onto future backend mutations.
 */
import type {
  Account,
  Collection,
  Comment,
  DistrictId,
  ID,
  Notification,
  Opportunity,
  Post,
  Product,
  Ref,
  Shop,
  Thread,
  WorldState,
} from '@/lib/types'

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
        body: `Welcome to PLACES, ${account.name}! Your profile lives in YourPlace. Take a course in MindPlace, open a shop in MarketPlace, or find work in WorkPlace — it's all one identity.`,
      },
    ],
  }
  next = { ...next, threads: [welcome, ...next.threads] }
  return notify(next, account.id, { text: 'Welcome to PLACES — your home is ready in YourPlace.', href: '/yourplace', district: 'yourplace' }, now)
}

export function signIn(s: WorldState, email: string): WorldState {
  const acc = s.accounts.find((a) => a.email === email.trim().toLowerCase())
  if (!acc) throw new ActionError('No account with that email on this device yet. Create one to get started.')
  return { ...s, accountId: acc.id }
}

export const signOut = (s: WorldState): WorldState => ({ ...s, accountId: null })

export type ProfilePatch = Partial<Pick<Account, 'name' | 'avatar' | 'bio' | 'location' | 'headline' | 'interests' | 'skills' | 'openTo'>>

export function updateProfile(s: WorldState, patch: ProfilePatch): WorldState {
  const me = need(s)
  if (patch.name !== undefined && !patch.name.trim()) throw new ActionError('Your name cannot be empty.')
  return { ...s, accounts: s.accounts.map((a) => (a.id === me ? { ...a, ...patch } : a)) }
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
    opportunities: s.opportunities.filter((o) => o.postedById !== me),
    applications: s.applications.filter((a) => a.applicantId !== me),
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

export const STRIPE_LINK_RE = /^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com|donate\.stripe\.com)\//

export function createShop(s: WorldState, input: Pick<Shop, 'name' | 'category' | 'description' | 'image'>, now: number): { state: WorldState; id: ID } {
  const me = need(s)
  if (s.shops.some((x) => x.ownerId === me)) throw new ActionError('You already have a shop.')
  if (!input.name.trim()) throw new ActionError('Name your shop.')
  const id = uid('shp')
  return { state: { ...s, shops: [...s.shops, { ...input, name: input.name.trim(), id, ownerId: me, createdAt: now }] }, id }
}

export type ProductInput = Pick<Product, 'title' | 'description' | 'price' | 'image' | 'category'> & { stripeLink?: string }

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
  let next: WorldState = { ...s, orders: [{ id: uid('ord'), productId, buyerId: me, total: p.price, via, createdAt: now }, ...s.orders] }
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

export function createOpportunity(s: WorldState, input: OpportunityInput, now: number): { state: WorldState; id: ID } {
  const me = need(s)
  if (input.title.trim().length < 4) throw new ActionError('Add a title.')
  if (input.description.trim().length < 20) throw new ActionError('Describe the opportunity in at least a sentence or two.')
  const id = uid('opp')
  return { state: { ...s, opportunities: [{ ...input, ...kindIcon[input.kind], title: input.title.trim(), id, postedById: me, createdAt: now }, ...s.opportunities] }, id }
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
