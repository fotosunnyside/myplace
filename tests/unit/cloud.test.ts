import { describe, expect, it } from 'vitest'
import {
  addComment,
  apply,
  createOpportunity,
  createPost,
  createProduct,
  createShop,
  deletePost,
  hire,
  markInvoicePaid,
  addInvoice,
  openThread,
  placeOrder,
  sendMessage,
  signOut,
  signUp,
  startPlan,
  toggleFollow,
  toggleLike,
  toggleSave,
  votePoll,
  createCourse,
  updateProfile,
} from '@/lib/store/actions'
import { cloudChanges, diffRows, type Op } from '@/lib/store/cloud/diff'
import { fromCloud, ownedRows } from '@/lib/store/cloud/map'
import { TABLE_ORDER, type CloudData } from '@/lib/store/cloud/schema'
import { seedWorld } from '@/lib/store/seed'
import type { WorldState } from '@/lib/types'

const NOW = Date.UTC(2026, 8, 29, 12)
const base = () => signUp(seedWorld(NOW), { name: 'Ada Lovelace', username: 'ada', email: 'ada@example.com' }, NOW)
const meOf = (s: WorldState) => s.accountId!
const changes = (prev: WorldState, next: WorldState) => cloudChanges(prev, next, meOf(prev))
const summary = (ops: Op[]) => ops.map((o) => `${o.kind} ${o.table}${o.kind === 'insert' ? ` ×${o.rows.length}` : ''}`)

describe('what actions write to the shared world', () => {
  it('writes a new post, and removes it again', () => {
    const s = base()
    const next = createPost(s, { body: 'Hello world', pollOptions: ['Yes', 'No'] }, NOW)
    const ops = changes(s, next)
    expect(summary(ops)).toEqual(['insert posts ×1'])
    const row = (ops[0] as Extract<Op, { kind: 'insert' }>).rows[0]
    expect(row).toMatchObject({ author_id: meOf(s), body: 'Hello world', audience: 'public' })
    expect(row.poll).toEqual([expect.objectContaining({ label: 'Yes' }), expect.objectContaining({ label: 'No' })])
    expect(row).not.toHaveProperty('base_likes') // counts are not the author's to set

    const id = next.posts[0].id
    expect(summary(changes(next, deletePost(next, id)))).toEqual(['delete posts'])
  })

  it('writes only the member’s own like, comment and vote on someone else’s post', () => {
    const s = base()
    const liked = toggleLike(s, 'post_1')
    expect(changes(s, liked)).toEqual([{ kind: 'insert', table: 'post_likes', rows: [{ post_id: 'post_1', user_id: meOf(s) }] }])
    expect(changes(liked, toggleLike(liked, 'post_1'))).toEqual([{ kind: 'delete', table: 'post_likes', match: { post_id: 'post_1', user_id: meOf(s) } }])

    const commented = addComment(s, 'post_1', 'Lovely', NOW)
    const ops = changes(s, commented)
    expect(summary(ops)).toEqual(['insert post_comments ×1'])

    const voted = votePoll(s, 'post_3', 'o2')
    expect(changes(s, voted)).toEqual([{ kind: 'insert', table: 'poll_votes', rows: [{ post_id: 'post_3', user_id: meOf(s), option_id: 'o2' }] }])
    const switched = votePoll(voted, 'post_3', 'o1')
    expect(changes(voted, switched)).toEqual([{ kind: 'update', table: 'poll_votes', match: { post_id: 'post_3', user_id: meOf(s) }, values: { option_id: 'o1' } }])
  })

  it('follows, saves and edits the profile', () => {
    const s = base()
    expect(summary(changes(s, toggleFollow(s, 'p_maya')))).toEqual(['insert follows ×1'])
    expect(summary(changes(s, toggleSave(s, { kind: 'product', refId: 'prd_mug' }, NOW)))).toEqual(['insert saved_items ×1'])
    const edited = updateProfile(s, { bio: 'Poet of science', skills: ['Maths'] })
    expect(changes(s, edited)).toEqual([{ kind: 'update', table: 'profiles', match: { id: meOf(s) }, values: { bio: 'Poet of science', skills: ['Maths'] } }])
    expect(changes(edited, updateProfile(edited, { website: 'ada.dev' }))).toEqual([{ kind: 'update', table: 'profiles', match: { id: meOf(s) }, values: { website: 'https://ada.dev' } }])
  })

  it('opens a shop, lists a product and orders — without sending prices for orders', () => {
    const s = base()
    const shop = createShop(s, { name: 'Ada’s', category: 'Handmade', description: '', image: '/x.webp' }, NOW)
    expect(summary(changes(s, shop.state))).toEqual(['insert shops ×1'])
    const prod = createProduct(shop.state, { title: 'Engine', description: '', price: 5000, image: '/y.webp', category: 'Handmade', ships: true }, NOW)
    expect(summary(changes(shop.state, prod.state))).toEqual(['insert products ×1'])

    const ordered = placeOrder(s, 'prd_mug', 'test', NOW)
    const ops = changes(s, ordered)
    expect(summary(ops)).toEqual(['insert orders ×1'])
    const row = (ops[0] as Extract<Op, { kind: 'insert' }>).rows[0]
    expect(Object.keys(row).sort()).toEqual(['buyer_id', 'created_at', 'id', 'product_id', 'via']) // total and fee come from the database
  })

  it('starts a conversation: the thread, both participants, and the message', () => {
    const s = base()
    const opened = openThread(s, 'p_maya', undefined, NOW)
    const sent = sendMessage(opened.state, opened.id, 'Hi Maya', NOW + 1)
    const ops = changes(s, sent)
    expect(summary(ops)).toEqual(['insert threads ×1', 'insert thread_participants ×2', 'insert messages ×1'])
    const participants = (ops[1] as Extract<Op, { kind: 'insert' }>).rows
    expect(participants.find((p) => p.user_id === 'p_maya')).toEqual({ thread_id: opened.id, user_id: 'p_maya' }) // her read state stays hers
  })

  it('hires into a workroom, then requests and pays an invoice', () => {
    const employer = base()
    const posted = createOpportunity(employer, { title: 'Designer', org: 'Ada Co', location: 'Remote', type: 'Project', kind: 'project', tags: [], pay: '$1k', description: 'Design a lovely analytical engine brochure.' }, NOW)
    // Maya applies (her own write, made on her device)
    const withApp: WorldState = { ...posted.state, applications: [{ id: 'app_1', opportunityId: posted.id, applicantId: 'p_maya', message: 'x'.repeat(30), createdAt: NOW }] }
    const hired = hire(withApp, 'app_1', NOW)
    const ops = changes(withApp, hired.state)
    expect(summary(ops)).toEqual(['insert workrooms ×1', 'insert workroom_members ×2', 'insert workroom_channels ×2', 'insert contracts ×1'])
    // The guide's welcome message is written by the database, not by the employer.
    expect(ops.some((o) => o.table === 'workroom_messages')).toBe(false)

    // The worker's side: request payment…
    const contract = hired.state.contracts[0]
    const asWorker: WorldState = { ...hired.state, accountId: 'p_maya', accounts: [{ ...hired.state.people.find((p) => p.id === 'p_maya')!, email: 'm@x', openTo: [] }] }
    const invoiced = addInvoice(asWorker, contract.id, { amount: 25000, description: 'First half' }, NOW)
    expect(summary(changes(asWorker, invoiced))).toEqual(['insert invoices ×1'])

    // …and the employer marks it paid: only status and date change.
    const back: WorldState = { ...invoiced, accountId: employer.accountId, accounts: employer.accounts }
    const paid = markInvoicePaid(back, contract.id, invoiced.contracts[0].invoices[0].id, NOW + 5)
    expect(changes(back, paid)).toEqual([
      { kind: 'update', table: 'invoices', match: { id: invoiced.contracts[0].invoices[0].id }, values: { status: 'paid', paid_at: new Date(NOW + 5).toISOString() } },
    ])
  })

  it('starts a plan, then publishes a course with its lessons', () => {
    const b = base()
    const plan = startPlan(b, 'create', 'test', NOW)
    expect(changes(b, plan)).toEqual([
      {
        kind: 'insert',
        table: 'member_plans',
        rows: [{ user_id: meOf(plan), kind: 'create', quantity: 1, status: 'active', via: 'test', since: new Date(NOW).toISOString(), renews_at: new Date(NOW + 30 * 86_400_000).toISOString() }],
      },
    ])
    // Another course on Create raises the quantity, nothing else.
    expect(summary(changes(plan, startPlan(plan, 'create', 'test', NOW)))).toEqual(['update member_plans'])
    const made = createCourse(plan, { title: 'Engines', subtitle: '', description: 'd', image: '/c.webp', topic: 'Tech', kind: 'course', price: 1900, billing: 'monthly', lessons: [{ title: 'One', minutes: 5, body: 'Hi' }, { title: 'Two', minutes: 5, body: 'There' }] }, NOW)
    const ops = changes(plan, made.state)
    expect(summary(ops)).toEqual(['insert courses ×1', 'insert course_lessons ×2', 'insert lesson_bodies ×2'])
    expect(ops[0].kind === 'insert' && ops[0].rows[0]).toMatchObject({ price: 1900, billing: 'monthly' })
  })

  it('never turns signing out (or in) into deletes', () => {
    const s = createPost(base(), { body: 'Mine' }, NOW)
    expect(changes(s, signOut(s))).toEqual([])
    expect(cloudChanges(signOut(s), s, meOf(s))).toEqual([])
    // Without the guard, the same comparison would remove everything:
    expect(diffRows(ownedRows(s), ownedRows(signOut(s))).some((o) => o.kind === 'delete')).toBe(true)
  })

  it('does nothing for an action that changes nothing', () => {
    const s = base()
    expect(changes(s, apply(s, 'opp_1', 'I would love to help with this role, truly.', undefined, NOW)).map((o) => o.table)).toEqual(['applications'])
    expect(changes(s, s)).toEqual([])
  })
})

describe('reading the shared world', () => {
  const empty = () => Object.fromEntries(TABLE_ORDER.map((t) => [t, []])) as unknown as CloudData

  it('assembles people, posts with likes, comments and votes, and the member’s private things', () => {
    const d = empty()
    d.profiles = [
      { id: 'u1', user_id: 'u1', username: 'ada', name: 'Ada', avatar: '', bio: '', location: '', headline: '', interests: [], skills: [], open_to: ['jobs'], joined_at: '2026-01-01T00:00:00Z' },
      { id: 'p_maya', user_id: null, username: 'mayamakes', name: 'Maya', avatar: '', bio: '', location: '', headline: '', interests: [], skills: [], open_to: [], joined_at: '2026-01-01T00:00:00Z', base_followers: 3400 },
    ]
    d.member_plans = [
      { user_id: 'u1', kind: 'pass', quantity: 1, status: 'active', via: 'test', since: '2026-01-01T00:00:00Z', renews_at: '2026-02-01T00:00:00Z' },
      { user_id: 'u1', kind: 'create', quantity: 2, status: 'canceled', via: 'test', since: '2026-01-01T00:00:00Z', renews_at: '2026-02-01T00:00:00Z' },
    ]
    d.posts = [{ id: 'post_1', author_id: 'p_maya', body: 'Hi', image: null, video: 'https://x.supabase.co/storage/v1/object/public/videos/p_maya/a.mp4', link: null, location: null, poll: [{ id: 'o1', label: 'A' }], audience: 'public', created_at: '2026-09-29T10:00:00Z', base_likes: 5, base_comments: 0 }]
    d.post_likes = [{ post_id: 'post_1', user_id: 'u1' }]
    d.post_comments = [{ id: 'c1', post_id: 'post_1', author_id: 'u1', body: 'Nice', created_at: '2026-09-29T11:00:00Z' }]
    d.poll_votes = [{ post_id: 'post_1', user_id: 'u1', option_id: 'o1' }]
    d.notifications = [{ id: 'n1', user_id: 'u1', text: 'Hello', href: '/', district: 'yourplace', read: false, created_at: '2026-09-29T11:00:00Z' }]

    const w = fromCloud(d, { id: 'u1', email: 'ada@example.com' })
    expect(w.accountId).toBe('u1')
    expect(w.accounts[0]).toMatchObject({ email: 'ada@example.com', openTo: ['jobs'], plans: { pass: { status: 'active' }, create: { status: 'canceled', quantity: 2 } }, member: true })
    expect(w.people).toEqual([expect.objectContaining({ id: 'p_maya', member: false, baseFollowers: 3400 })])
    expect(w.posts[0]).toMatchObject({ video: 'https://x.supabase.co/storage/v1/object/public/videos/p_maya/a.mp4', likes: ['u1'], baseLikes: 5, comments: [{ id: 'c1', body: 'Nice' }], poll: [{ id: 'o1', label: 'A', votes: ['u1'] }] })
    expect(w.notifications.u1).toHaveLength(1)

    // Reading back what was loaded produces no writes.
    expect(diffRows(ownedRows(w), ownedRows(w))).toEqual([])
  })

  it('shows guests the public world with nobody signed in', () => {
    const w = fromCloud(empty(), null)
    expect(w.accountId).toBeNull()
    expect(w.accounts).toEqual([])
  })
})

describe('bringing on-device content into the shared world', () => {
  it('moves what the member made on this device to their cloud account, once', async () => {
    const { bringDeviceContent } = await import('@/lib/store/cloud/import')
    // On the old device: Ada posted, opened a shop, saved a product and followed Maya.
    let device = base()
    device = createPost(device, { body: 'From my old phone' }, NOW)
    device = createShop(device, { name: 'Ada’s', category: 'Handmade', description: '', image: '/x.webp' }, NOW).state
    device = toggleSave(device, { kind: 'product', refId: 'prd_mug' }, NOW)
    device = toggleFollow(device, 'p_maya')
    device = updateProfile(device, { bio: 'Hello from before' })

    // In the cloud: a fresh account with the same email.
    const cloud: WorldState = { ...seedWorld(NOW), accountId: 'u1', accounts: [{ ...device.accounts[0], id: 'u1', bio: '' }] }
    const merged = bringDeviceContent(cloud, device, { id: 'u1', email: 'ada@example.com' })
    expect(merged.posts[0]).toMatchObject({ body: 'From my old phone', authorId: 'u1' })
    expect(merged.shops.find((x) => x.ownerId === 'u1')?.name).toBe('Ada’s')
    expect(merged.saved.u1).toHaveLength(1)
    expect(merged.following.u1).toEqual(['p_maya'])
    expect(merged.accounts[0].bio).toBe('Hello from before')
    expect(summary(cloudChanges(cloud, merged, 'u1'))).toEqual(['update profiles', 'insert follows ×1', 'insert posts ×1', 'insert saved_items ×1', 'insert shops ×1'])

    // Running it again brings nothing new.
    expect(bringDeviceContent(merged, device, { id: 'u1', email: 'ada@example.com' })).toBe(merged)
    // Someone else's email brings nothing.
    expect(bringDeviceContent(cloud, device, { id: 'u1', email: 'other@example.com' })).toBe(cloud)
  })
})
