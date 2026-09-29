'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, Briefcase, MapPin, MessageCircle, Store } from 'lucide-react'
import type { Person } from '@/lib/types'
import { Avatar, Button, ButtonLink, Card } from '@/components/ui/primitives'
import { RoomSquares } from '@/components/spaces/RoomSquares'
import { openThread, toggleFollow } from '@/lib/store/actions'
import { perform, useWorld, withAuth } from '@/lib/store/hooks'
import { enrollmentsOf, followerCount, followingOf, formatCount, isFollowing, shopOf } from '@/lib/store/selectors'

/** `rooms`: show the official PLACES rooms under the panel (your own YourPlace). */
export function ProfileSummary({ p, own, compact = false, rooms = false }: { p: Person; own: boolean; compact?: boolean; rooms?: boolean }) {
  const world = useWorld()
  const router = useRouter()
  const following = isFollowing(world, p.id)
  const shop = shopOf(world, p.id)
  const done = enrollmentsOf(world, p.id).filter((e) => {
    const c = world.courses.find((x) => x.id === e.courseId)
    return c && e.completed.length === c.lessons.length
  }).length
  const collections = (world.collections[p.id] ?? []).length
  const account = world.accounts.find((a) => a.id === p.id)

  const stats = [
    { label: 'Following', value: formatCount(followingOf(world, p.id).length + (p.baseFollowing ?? 0)) },
    { label: 'Followers', value: formatCount(followerCount(world, p.id)) },
    { label: own ? 'Collections' : 'Posts', value: formatCount(own ? collections : world.posts.filter((x) => x.authorId === p.id).length) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-3 @3xl:flex-col @3xl:items-start @3xl:gap-4">
          <Avatar src={p.avatar} alt={p.name} name={p.name} size={compact ? 52 : 60} ring className="@3xl:!h-24 @3xl:!w-24 @3xl:!text-3xl" />
          <div className="min-w-0">
            <h2 className="text-[0.95rem] font-semibold text-navy @3xl:font-serif @3xl:text-3xl @3xl:font-medium">{p.name}</h2>
            <p className="text-[0.62rem] text-muted @3xl:text-sm">@{p.username}</p>
            {p.location && (
              <p className="mt-0.5 flex items-center gap-1 text-[0.58rem] text-muted @3xl:text-sm">
                <MapPin className="h-2.5 w-2.5 @3xl:h-3.5 @3xl:w-3.5" /> {p.location}
              </p>
            )}
          </div>
        </div>
        {p.headline && <p className="mt-3 hidden text-sm font-medium text-navy @3xl:block">{p.headline}</p>}
        <p className="mt-2 text-[0.62rem] leading-relaxed text-navy-soft @3xl:text-[0.95rem]">{p.bio || (own ? 'Add a short bio so people know who you are.' : '')}</p>
      </div>

      {own ? (
        <ButtonLink href="/settings" size="sm" className="w-full @3xl:h-11 @3xl:text-sm">
          Edit Profile
        </ButtonLink>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant={following ? 'outline' : 'primary'} onClick={() => withAuth(() => perform((s) => toggleFollow(s, p.id), following ? `Unfollowed ${p.name}.` : `Following ${p.name}.`), `Join PLACES to follow ${p.name}.`)} className="@3xl:h-11 @3xl:text-sm">
            {following ? 'Following' : 'Follow'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              withAuth(() => {
                const r = perform((s, now) => openThread(s, p.id, undefined, now))
                if (r.ok) router.push(`/messages/?t=${r.id}`)
              }, `Join PLACES to message ${p.name}.`)
            }
            className="@3xl:h-11 @3xl:text-sm"
          >
            <MessageCircle className="h-4 w-4" /> Message
          </Button>
        </div>
      )}

      <dl className="grid grid-cols-3 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <dd className="text-[0.72rem] font-semibold text-navy @3xl:text-xl">{s.value}</dd>
            <dt className="text-[0.52rem] text-muted @3xl:text-xs">{s.label}</dt>
          </div>
        ))}
      </dl>

      {!compact && (
        <Card className="hidden p-4 @3xl:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Across PLACES</p>
          <ul className="grid gap-2.5 text-sm">
            <li className="flex items-center gap-2.5">
              <BookOpen className="h-4 w-4 text-teal" /> {done} course{done === 1 ? '' : 's'} completed
            </li>
            <li className="flex items-center gap-2.5">
              <Store className="h-4 w-4 text-coral" />
              {shop ? (
                <Link href={`/marketplace/shop/?id=${shop.id}`} className="hover:underline">
                  {shop.name} · {world.products.filter((x) => x.shopId === shop.id).length} listings
                </Link>
              ) : (
                'No shop yet'
              )}
            </li>
            <li className="flex items-center gap-2.5">
              <Briefcase className="h-4 w-4 text-leaf" /> {account?.openTo.length ? `Open to ${account.openTo.join(' & ')}` : p.headline || 'Exploring WorkPlace'}
            </li>
          </ul>
          {p.interests.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.interests.map((i) => (
                <span key={i} className="rounded-full bg-ivory px-2.5 py-1 text-[0.7rem] font-medium text-navy-soft">
                  {i}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {rooms && !compact && <RoomSquares />}
    </div>
  )
}
