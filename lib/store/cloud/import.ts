import type { ID, WorldState } from '@/lib/types'
import type { CloudIdentity } from './map'

/**
 * A member who used PLACES on this device before the shared world existed keeps what they made:
 * their profile details, posts, discussions, shop and products, courses, opportunities, collections,
 * saved items, follows and learning progress move to their cloud account (matched by email).
 * Things involving other people on the old device (orders, messages, workrooms) stay behind.
 * Returns `current` unchanged when there's nothing to bring.
 */
export function bringDeviceContent(current: WorldState, device: WorldState, who: CloudIdentity): WorldState {
  const local = device.accounts?.find((a) => a.email?.toLowerCase() === who.email.toLowerCase())
  const me = current.accounts.find((a) => a.id === who.id)
  if (!local || !me) return current

  const from = local.id
  const swap = (id: ID) => (id === from ? who.id : id)
  const has = <T extends { id: ID }>(list: T[], id: ID) => list.some((x) => x.id === id)
  let changed = false
  const mark = <T,>(list: T[]) => {
    if (list.length) changed = true
    return list
  }

  const posts = mark(device.posts.filter((p) => p.authorId === from && !has(current.posts, p.id))).map((p) => ({
    ...p,
    authorId: who.id,
    likes: [],
    comments: [],
    poll: p.poll?.map((o) => ({ ...o, votes: [] })),
  }))
  const discussions = mark(device.discussions.filter((d) => d.authorId === from && !has(current.discussions, d.id))).map((d) => ({ ...d, authorId: who.id, upvoters: [], replies: [] }))

  const hasShop = current.shops.some((x) => x.ownerId === who.id)
  const localShop = device.shops.find((x) => x.ownerId === from)
  const shops = !hasShop && localShop && !has(current.shops, localShop.id) ? mark([{ ...localShop, ownerId: who.id }]) : []
  const products = shops.length ? mark(device.products.filter((p) => p.shopId === localShop!.id && !has(current.products, p.id))) : []

  const plan = local.creatorPlan?.status === 'active' && !me.creatorPlan ? local.creatorPlan : me.creatorPlan
  const courses = mark(device.courses.filter((c) => c.expertId === from && !has(current.courses, c.id))).map((c) => ({ ...c, expertId: who.id }))
  const opportunities = mark(device.opportunities.filter((o) => o.postedById === from && !has(current.opportunities, o.id))).map((o) => ({ ...o, postedById: who.id }))

  const known = new Set([...current.people.map((p) => p.id), who.id])
  const follows = (device.following?.[from] ?? []).map(swap).filter((id) => known.has(id) && id !== who.id && !(current.following[who.id] ?? []).includes(id))
  if (follows.length) changed = true

  const courseIds = new Set([...current.courses, ...courses].map((c) => c.id))
  const enrollments = (device.enrollments?.[from] ?? []).filter((e) => courseIds.has(e.courseId) && !(current.enrollments[who.id] ?? []).some((x) => x.courseId === e.courseId))
  if (enrollments.length) changed = true

  const collections = mark((device.collections?.[from] ?? []).filter((c) => !(current.collections[who.id] ?? []).some((x) => x.id === c.id)))
  const saved = (device.saved?.[from] ?? []).filter((x) => !(current.saved[who.id] ?? []).some((y) => y.kind === x.kind && y.refId === x.refId))
  if (saved.length) changed = true

  const profile = {
    bio: me.bio || local.bio,
    location: me.location || local.location,
    headline: me.headline || local.headline,
    avatar: me.avatar || local.avatar,
    interests: me.interests.length ? me.interests : local.interests,
    skills: me.skills.length ? me.skills : local.skills,
    openTo: me.openTo.length ? me.openTo : local.openTo,
    creatorPlan: plan,
  }
  if (Object.entries(profile).some(([k, v]) => JSON.stringify(v) !== JSON.stringify((me as unknown as Record<string, unknown>)[k]))) changed = true

  if (!changed) return current
  return {
    ...current,
    accounts: current.accounts.map((a) => (a.id === who.id ? { ...a, ...profile } : a)),
    posts: [...posts, ...current.posts],
    discussions: [...discussions, ...current.discussions],
    shops: [...current.shops, ...shops],
    products: [...products, ...current.products],
    courses: [...courses, ...current.courses],
    opportunities: [...opportunities, ...current.opportunities],
    following: { ...current.following, [who.id]: [...(current.following[who.id] ?? []), ...follows] },
    enrollments: { ...current.enrollments, [who.id]: [...(current.enrollments[who.id] ?? []), ...enrollments] },
    collections: { ...current.collections, [who.id]: [...collections, ...(current.collections[who.id] ?? [])] },
    saved: { ...current.saved, [who.id]: [...saved, ...(current.saved[who.id] ?? [])] },
  }
}
