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

  it('requires an active creator plan to publish', () => {
    let s = joined()
    expect(() => A.createCourse(s, course(), NOW)).toThrow(/creator plan/)
    s = A.subscribeCreator(s, 'test', NOW)
    expect(A.hasCreatorPlan(s)).toBe(true)
    const r = A.createCourse(s, course(), NOW)
    expect(r.state.courses[0]).toMatchObject({ title: 'Watercolor Basics', expertId: me(s), subtitle: 'Free course' })
    expect(A.isListed(r.state, r.id)).toBe(true)
    const paused = A.cancelCreator(r.state)
    expect(A.isListed(paused, r.id)).toBe(false)
  })

  it('validates lessons, prices and Stripe links', () => {
    const s = A.subscribeCreator(joined(), 'test', NOW)
    expect(() => A.createCourse(s, course({ lessons: [{ title: 'Only a title', minutes: 5, body: '' }] }), NOW)).toThrow(/title and some content/)
    expect(() => A.createCourse(s, course({ price: 50 }), NOW)).toThrow(/at least \$1/)
    expect(() => A.createCourse(s, course({ price: 2900, stripeLink: 'https://example.com' }), NOW)).toThrow(/Stripe/)
  })

  it('locks paid courses until purchased, then enrolls the buyer', () => {
    let s = A.subscribeCreator(joined(), 'test', NOW)
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
    let s = A.subscribeCreator(joined(), 'test', NOW)
    const r = A.createCourse(s, course(), NOW)
    s = A.updateCourse(r.state, r.id, course({ title: 'Watercolor for Everyone' }))
    expect(s.courses[0].title).toBe('Watercolor for Everyone')
    expect(() => A.updateCourse(s, 'crs_digital', course())).toThrow(/own courses/)
    expect(A.deleteCourse(s, r.id).courses.some((c) => c.id === r.id)).toBe(false)
  })
})
