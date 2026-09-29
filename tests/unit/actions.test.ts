import { describe, expect, it } from 'vitest'
import * as A from '@/lib/store/actions'
import { seedWorld } from '@/lib/store/seed'
import { migrate } from '@/lib/store/store'
import { search, unreadNotifications } from '@/lib/store/selectors'
import type { WorldState } from '@/lib/types'

const NOW = Date.UTC(2026, 8, 27, 12)
const joined = (): WorldState => A.signUp(seedWorld(NOW), { name: 'Sam Rivera', username: 'samr', email: 'sam@example.com' }, NOW)
const me = (s: WorldState) => s.accountId!

describe('accounts', () => {
  it('signs up, welcomes and signs in', () => {
    const s = joined()
    expect(s.accounts).toHaveLength(1)
    expect(s.threads[0].messages[0].body).toMatch(/Welcome to PLACES, Sam Rivera/)
    expect(unreadNotifications(s)).toBe(1)
    const out = A.signOut(s)
    expect(out.accountId).toBeNull()
    expect(A.signIn(out, 'SAM@example.com').accountId).toBe(s.accountId)
  })

  it('validates usernames, emails and duplicates', () => {
    const s = seedWorld(NOW)
    expect(() => A.signUp(s, { name: 'A', username: 'x', email: 'a@b.co' }, NOW)).toThrow(/3–20/)
    expect(() => A.signUp(s, { name: 'A', username: 'valid_name', email: 'nope' }, NOW)).toThrow(/email/)
    expect(() => A.signUp(s, { name: 'A', username: 'josie', email: 'a@b.co' }, NOW)).toThrow(/taken/)
    expect(() => A.signIn(s, 'ghost@example.com')).toThrow(/No account/)
  })

  it('requires sign-in for actions', () => {
    expect(() => A.createPost(seedWorld(NOW), { body: 'hi' }, NOW)).toThrow(A.ActionError)
  })

  it('deletes an account and everything it created', () => {
    let s = joined()
    s = A.createPost(s, { body: 'mine' }, NOW)
    s = A.toggleLike(s, 'post_1')
    s = A.createShop(s, { name: 'Shop', category: 'Art', description: '', image: '/x.webp' }, NOW).state
    s = A.createProduct(s, { title: 'Thing', description: '', price: 1000, image: '/x.webp', category: 'Handmade' }, NOW).state
    const gone = A.deleteAccount(s)
    expect(gone.accounts).toHaveLength(0)
    expect(gone.posts.some((p) => p.body === 'mine')).toBe(false)
    expect(gone.posts.find((p) => p.id === 'post_1')!.likes).toHaveLength(0)
    expect(gone.products.some((p) => p.title === 'Thing')).toBe(false)
    expect(gone.threads).toHaveLength(0)
  })
})

describe('YourPlace', () => {
  it('posts, likes, comments and votes (single choice)', () => {
    let s = A.createPost(joined(), { body: 'Hello', pollOptions: ['A', 'B'] }, NOW)
    const post = s.posts[0]
    s = A.toggleLike(s, post.id)
    expect(s.posts[0].likes).toEqual([me(s)])
    s = A.addComment(s, post.id, 'Nice', NOW)
    expect(s.posts[0].comments).toHaveLength(1)
    const [a, b] = s.posts[0].poll!
    s = A.votePoll(s, post.id, a.id)
    s = A.votePoll(s, post.id, b.id)
    expect(s.posts[0].poll!.map((o) => o.votes.length)).toEqual([0, 1])
    s = A.votePoll(s, post.id, b.id)
    expect(s.posts[0].poll!.map((o) => o.votes.length)).toEqual([0, 0])
  })

  it('rejects empty posts, bad links and one-option polls', () => {
    const s = joined()
    expect(() => A.createPost(s, { body: '  ' }, NOW)).toThrow(/Write something/)
    expect(() => A.createPost(s, { body: 'x', link: 'ftp://nope' }, NOW)).toThrow(/http/)
    expect(() => A.createPost(s, { body: 'x', pollOptions: ['only'] }, NOW)).toThrow(/two options/)
  })

  it('saves things and organises them into collections', () => {
    let s = A.toggleSave(joined(), { kind: 'course', refId: 'crs_digital' }, NOW)
    expect(A.isSaved(s, { kind: 'course', refId: 'crs_digital' })).toBe(true)
    s = A.createCollection(s, 'Learning', NOW)
    const col = s.collections[me(s)][0]
    s = A.toggleInCollection(s, col.id, { kind: 'course', refId: 'crs_digital' })
    expect(s.collections[me(s)][0].items).toHaveLength(1)
  })
})

describe('MindPlace', () => {
  it('tracks lesson progress and celebrates completion', () => {
    let s = joined()
    const course = s.courses.find((c) => c.id === 'crs_wellness')!
    for (const l of course.lessons) s = A.toggleLesson(s, course.id, l.id, NOW)
    expect(s.enrollments[me(s)][0].completed).toHaveLength(course.lessons.length)
    expect(s.notifications[me(s)][0].text).toMatch(/completed Health & Wellness/)
  })

  it('starts discussions, replies and upvotes', () => {
    const r = A.createDiscussion(joined(), { title: 'How do you compost indoors?', body: '', category: 'Sustainability' }, NOW)
    let s = A.replyToDiscussion(r.state, r.id, 'Bokashi!', NOW)
    s = A.toggleUpvote(s, r.id)
    const d = s.discussions.find((x) => x.id === r.id)!
    expect(d.replies).toHaveLength(1)
    expect(d.upvoters).toHaveLength(1)
    expect(d.tone).toBe('leaf')
  })
})

describe('MarketPlace', () => {
  it('opens a shop, lists a product and validates Stripe links', () => {
    let s = A.createShop(joined(), { name: 'Studio', category: 'Art', description: '', image: '/x.webp' }, NOW).state
    expect(() => A.createShop(s, { name: 'Again', category: 'Art', description: '', image: '' }, NOW)).toThrow(/already/)
    const base = { title: 'Print', description: '', price: 2400, image: '/x.webp', category: 'Digital' as const }
    expect(() => A.createProduct(s, { ...base, stripeLink: 'https://evil.example.com/pay' }, NOW)).toThrow(/Stripe/)
    expect(() => A.createProduct(s, { ...base, price: 10 }, NOW)).toThrow(/\$0.50/)
    const r = A.createProduct(s, { ...base, stripeLink: 'https://buy.stripe.com/test_123' }, NOW)
    s = r.state
    expect(s.products[0].stripeLink).toBe('https://buy.stripe.com/test_123')
  })

  it('records orders and notifies the buyer', () => {
    const s = A.placeOrder(joined(), 'prd_mug', 'test', NOW)
    expect(s.orders[0]).toMatchObject({ productId: 'prd_mug', total: 4800, via: 'test' })
    expect(s.notifications[me(s)][0].text).toMatch(/Order confirmed/)
  })
})

describe('WorkPlace & messages', () => {
  it('applies once with a real note', () => {
    let s = joined()
    expect(() => A.apply(s, 'opp_1', 'too short', undefined, NOW)).toThrow(/20 characters/)
    s = A.apply(s, 'opp_1', 'I have made videos for three plant shops.', undefined, NOW)
    expect(s.applications).toHaveLength(1)
    expect(() => A.apply(s, 'opp_1', 'I have made videos for three plant shops.', undefined, NOW)).toThrow(/already/)
  })

  it('reuses threads per context and sends messages', () => {
    const ctx = { kind: 'product' as const, refId: 'prd_mug', label: 'Mug' }
    const a = A.openThread(joined(), 'p_maya', ctx, NOW)
    const b = A.openThread(a.state, 'p_maya', ctx, NOW)
    expect(b.id).toBe(a.id)
    const s = A.sendMessage(b.state, a.id, 'Hi!', NOW)
    expect(s.threads[0].messages.at(-1)!.body).toBe('Hi!')
  })
})

describe('store', () => {
  it('keeps people’s own content when the seed version changes', () => {
    let s = A.createPost(joined(), { body: 'survives' }, NOW)
    s = { ...s, version: 0, posts: [...s.posts, { ...s.posts[0], id: 'old_seed', authorId: 'p_leo', body: 'stale seed' }] }
    const m = migrate(s, NOW)
    expect(m.posts.some((p) => p.body === 'survives')).toBe(true)
    expect(m.posts.some((p) => p.body === 'stale seed')).toBe(false)
    expect(m.accounts).toHaveLength(1)
  })

  it('searches across every Place', () => {
    const r = search(seedWorld(NOW), 'ceramic')!
    expect(r.products.map((p) => p.id)).toContain('prd_mug')
    expect(r.people.map((p) => p.username)).toContain('mayamakes')
  })
})

describe('creators', () => {
  const course = (over: Partial<A.CourseInput> = {}): A.CourseInput => ({
    title: 'Watercolor Basics',
    subtitle: '',
    description: 'Paint your first landscape.',
    image: '/x.webp',
    topic: 'Creativity',
    kind: 'course',
    price: 0,
    lessons: [{ title: 'Materials', minutes: 5, body: 'Brushes, paper, paint.' }],
    ...over,
  })

  it('publishes with Create ($7 per course) or PLACES Pass', () => {
    let s = joined()
    expect(() => A.createCourse(s, course(), NOW)).toThrow(/Create in MindPlace or PLACES Pass/)
    s = A.startPlan(s, 'create', 'test', NOW)
    expect(A.hasCreatorPlan(s)).toBe(true)
    expect(A.courseSlotsLeft(s)).toBe(1)
    const r = A.createCourse(s, course(), NOW)
    expect(r.state.courses[0]).toMatchObject({ title: 'Watercolor Basics', expertId: me(s), subtitle: 'Free course' })
    expect(A.isListed(r.state, r.id)).toBe(true)
    // Create is per course: a second one needs another Create (or the Pass).
    expect(() => A.createCourse(r.state, course({ title: 'Second course' }), NOW)).toThrow(/Add another course/)
    let more = A.startPlan(r.state, 'create', 'test', NOW)
    expect(A.activePlan(more, 'create')?.quantity).toBe(2)
    more = A.createCourse(more, course({ title: 'Second course' }), NOW).state
    const paused = A.cancelPlan(r.state, 'create')
    expect(A.isListed(paused, r.id)).toBe(false)
    const withPass = A.startPlan(paused, 'pass', 'test', NOW)
    expect(A.isListed(withPass, r.id)).toBe(true)
    expect(A.courseSlotsLeft(withPass)).toBe(Infinity)
  })

  it('reads an old on-device creator plan as Create', () => {
    const s = joined()
    const legacy = { ...s, accounts: s.accounts.map((a) => ({ ...a, creatorPlan: { status: 'active' as const, via: 'test' as const, since: NOW, renewsAt: NOW + 1 } })) }
    expect(A.hasCreatorPlan(legacy)).toBe(true)
    expect(A.courseSlotsLeft(legacy)).toBe(1)
    expect(A.hasCreatorPlan(A.cancelPlan(legacy, 'create'))).toBe(false)
  })

  it('offers one-time and monthly pricing, with a 5% PLACES fee unless the creator has the Pass', () => {
    let s = A.startPlan(joined(), 'create', 'test', NOW)
    s = A.startPlan(s, 'create', 'test', NOW)
    const once = A.createCourse(s, course({ price: 10000 }), NOW)
    const monthly = A.createCourse(once.state, course({ title: 'Studio membership', price: 2000, billing: 'monthly' }), NOW)
    expect(monthly.state.courses[0]).toMatchObject({ price: 2000, billing: 'monthly' })
    expect(monthly.state.courses[1].billing).toBeUndefined()
    const creator = me(s)
    let buyer = A.signUp(A.signOut(monthly.state), { name: 'Learner', username: 'learner', email: 'l@example.com' }, NOW)
    buyer = A.purchaseCourse(buyer, once.id, 'test', NOW)
    expect(buyer.coursePurchases[0]).toMatchObject({ total: 10000, fee: 500 }) // $100 → $5
    buyer = A.purchaseCourse(buyer, monthly.id, 'test', NOW)
    expect(buyer.coursePurchases[0]).toMatchObject({ total: 2000, fee: 100 }) // $20/month → $1/month
    // With the Pass, PLACES takes 0%.
    const passCreator = { ...buyer, accounts: buyer.accounts.map((a) => (a.id === creator ? { ...a, plans: { pass: { status: 'active' as const, via: 'test' as const, since: NOW, renewsAt: NOW + 1, quantity: 1 } } } : a)) }
    expect(A.courseFee(passCreator, creator, 10000)).toBe(0)
    expect(A.courseFee(buyer, creator, 0)).toBe(0)
  })

  it('validates lessons, prices and Stripe links', () => {
    const s = A.startPlan(joined(), 'create', 'test', NOW)
    expect(() => A.createCourse(s, course({ lessons: [{ title: 'Only a title', minutes: 5, body: '' }] }), NOW)).toThrow(/title and some content/)
    expect(() => A.createCourse(s, course({ price: 50 }), NOW)).toThrow(/at least \$1/)
    expect(() => A.createCourse(s, course({ price: 2900, stripeLink: 'https://example.com' }), NOW)).toThrow(/Stripe/)
  })

  it('locks paid courses until purchased, then enrolls the buyer', () => {
    let s = A.startPlan(joined(), 'create', 'test', NOW)
    const r = A.createCourse(s, course({ price: 2900 }), NOW)
    s = A.signOut(r.state)
    s = A.signUp(s, { name: 'Learner', username: 'learner', email: 'l@example.com' }, NOW)
    expect(A.canAccessCourse(s, r.id)).toBe(false)
    expect(() => A.enroll(s, r.id, NOW)).toThrow(/Buy/)
    s = A.purchaseCourse(s, r.id, 'test', NOW)
    expect(A.canAccessCourse(s, r.id)).toBe(true)
    expect(s.coursePurchases[0]).toMatchObject({ courseId: r.id, total: 2900, via: 'test' })
    expect(s.enrollments[me(s)][0].courseId).toBe(r.id)
  })

  it('only lets authors edit or delete their courses', () => {
    let s = A.startPlan(joined(), 'create', 'test', NOW)
    const r = A.createCourse(s, course(), NOW)
    s = A.updateCourse(r.state, r.id, course({ title: 'Watercolor for Everyone' }))
    expect(s.courses[0].title).toBe('Watercolor for Everyone')
    expect(() => A.updateCourse(s, 'crs_digital', course())).toThrow(/own courses/)
    expect(A.deleteCourse(s, r.id).courses.some((c) => c.id === r.id)).toBe(false)
  })
})

describe('ecosystem: fees, job posts, ads, hiring & workrooms', () => {
  it('charges a 1% platform fee on shipped items only — even with the Pass', () => {
    let s = A.createShop(joined(), { name: 'Studio', category: 'Art', description: '', image: '/x.webp' }, NOW).state
    s = A.createProduct(s, { title: 'Vase', description: '', price: 5000, image: '/x.webp', category: 'Handmade', ships: true }, NOW).state
    const vase = s.products[0]
    s = A.createProduct(s, { title: 'Template', description: '', price: 1500, image: '/x.webp', category: 'Digital' }, NOW).state
    s = A.placeOrder(s, vase.id, 'test', NOW)
    expect(s.orders[0].fee).toBe(50)
    s = A.placeOrder(s, s.products[0].id, 'test', NOW)
    expect(s.orders[0].fee).toBeUndefined()
    s = A.startPlan(s, 'pass', 'test', NOW)
    s = A.placeOrder(s, vase.id, 'test', NOW)
    expect(s.orders[0].fee).toBe(50)
  })

  it('records how the job-post fee was paid and validates before payment', () => {
    const input = { title: 'Bookkeeper', org: 'Studio', location: 'Remote', type: 'Part Time' as const, kind: 'job' as const, tags: [], pay: '$30/hr', description: 'Keep our books tidy every month.' }
    expect(() => A.checkOpportunity({ ...input, description: 'short' })).toThrow(/sentence/)
    const r = A.createOpportunity(joined(), input, NOW, 'stripe')
    expect(r.state.opportunities[0].paidVia).toBe('stripe')
    // Posting is included with PLACES Pass — and only with it.
    expect(() => A.createOpportunity(joined(), input, NOW, 'pass')).toThrow(/PLACES Pass/)
    const withPass = A.createOpportunity(A.startPlan(joined(), 'pass', 'test', NOW), input, NOW, 'pass')
    expect(withPass.state.opportunities[0].paidVia).toBe('pass')
  })

  it('lets hosts (Host a Space or the Pass) open their own spaces', () => {
    expect(A.canHostSpaces(joined())).toBe(false)
    expect(A.canHostSpaces(A.startPlan(joined(), 'host', 'test', NOW))).toBe(true)
    expect(A.canHostSpaces(A.startPlan(joined(), 'pass', 'test', NOW))).toBe(true)
    expect(A.canHostSpaces(A.startPlan(joined(), 'create', 'test', NOW))).toBe(false)
  })

  it('queues ads so each Place shows one at a time', () => {
    const ad = { business: 'Candle Co', headline: 'Small-batch candles', image: '/x.webp', url: 'https://candle.example', district: 'marketplace' as const, plan: 'week' as const }
    expect(() => A.checkAd({ ...ad, url: 'http://nope' })).toThrow(/https/)
    let s = A.createAd(joined(), ad, 'test', NOW).state
    s = A.createAd(s, { ...ad, business: 'Second' }, 'test', NOW).state
    expect(A.activeAd(s, 'marketplace', NOW + 1)?.business).toBe('Candle Co')
    expect(A.activeAd(s, 'marketplace', NOW + 8 * 86_400_000)?.business).toBe('Second')
    expect(A.activeAd(s, 'workplace', NOW + 1)).toBeUndefined()
  })

  it('hires an applicant into a workroom with a contract, invoices and payment', () => {
    let s = joined() // employer
    const employer = me(s)
    const posted = A.createOpportunity(s, { title: 'Logo design', org: 'Studio', location: 'Remote', type: 'Project', kind: 'project', tags: [], pay: '$300', description: 'A friendly logo for a small studio.' }, NOW)
    s = A.signOut(posted.state)
    s = A.signUp(s, { name: 'Wren Worker', username: 'wren', email: 'wren@example.com' }, NOW)
    const worker = me(s)
    s = A.apply(s, posted.id, 'I have designed logos for twenty small shops.', undefined, NOW)
    const appId = s.applications[0].id
    expect(() => A.hire(s, appId, NOW)).toThrow(/Only the person who posted/)
    s = A.signIn(A.signOut(s), 'sam@example.com')
    const hired = A.hire(s, appId, NOW)
    s = hired.state
    const room = s.workrooms.find((w) => w.id === hired.id)!
    expect(room.memberIds).toEqual([employer, worker])
    s = A.postWorkMessage(s, room.id, room.channels[0].id, 'Welcome aboard!', NOW)
    s = A.addChannel(s, room.id, 'Design Reviews').state
    expect(s.workrooms[0].channels.map((c) => c.name)).toContain('design-reviews')
    const contract = s.contracts[0]
    expect(() => A.addInvoice(s, contract.id, { amount: 30000, description: 'Logo' }, NOW)).toThrow(/Only the person hired/)
    s = A.signIn(A.signOut(s), 'wren@example.com')
    s = A.addInvoice(s, contract.id, { amount: 30000, description: 'Logo, final files', payLink: 'https://buy.stripe.com/test_x' }, NOW)
    s = A.signIn(A.signOut(s), 'sam@example.com')
    s = A.markInvoicePaid(s, contract.id, s.contracts[0].invoices[0].id, NOW)
    s = A.completeContract(s, contract.id, NOW)
    expect(s.contracts[0]).toMatchObject({ status: 'completed' })
    expect(s.contracts[0].invoices[0].status).toBe('paid')
    expect(() => A.addWorkroomMember(s, room.id, '@nobody_here', NOW)).toThrow(/No one/)
  })
})
