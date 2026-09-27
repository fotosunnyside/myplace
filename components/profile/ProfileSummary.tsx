import { BadgeCheck, BookOpen, Briefcase, MapPin, Store } from 'lucide-react'
import type { PlacesIdentity } from '@/lib/types'
import { formatCount } from '@/lib/data/identity'
import { Avatar, Button, Card } from '@/components/ui/primitives'

export function ProfileSummary({ identity, compact = false }: { identity: PlacesIdentity; compact?: boolean }) {
  const { profile, connections, collections, activity, reputation } = identity
  const stats = [
    { label: 'Following', value: formatCount(connections.following) },
    { label: 'Followers', value: formatCount(connections.followers) },
    { label: 'Collections', value: formatCount(collections.reduce((n, c) => n + c.itemCount, 0)) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-3 @3xl:flex-col @3xl:items-start @3xl:gap-4">
          <Avatar src={profile.avatar} alt={profile.name} size={compact ? 52 : 60} ring className="@3xl:!h-24 @3xl:!w-24" />
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-[0.95rem] font-semibold text-navy @3xl:font-serif @3xl:text-3xl @3xl:font-medium">
              {profile.name}
              <BadgeCheck className="hidden h-5 w-5 text-teal @3xl:inline" aria-label="Verified identity" />
            </h2>
            <p className="text-[0.62rem] text-muted @3xl:text-sm">@{profile.username}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[0.58rem] text-muted @3xl:text-sm">
              <MapPin className="h-2.5 w-2.5 @3xl:h-3.5 @3xl:w-3.5" /> {profile.location}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[0.62rem] leading-relaxed text-navy-soft @3xl:text-[0.95rem]">{profile.bio}</p>
      </div>

      <Button size="sm" className="w-full @3xl:h-11 @3xl:text-sm">
        Edit Profile
      </Button>

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
              <BookOpen className="h-4 w-4 text-teal" /> {activity.learning.coursesCompleted} courses completed
            </li>
            <li className="flex items-center gap-2.5">
              <Store className="h-4 w-4 text-coral" /> {activity.shop.shopName} · {activity.shop.listings} listings
            </li>
            <li className="flex items-center gap-2.5">
              <Briefcase className="h-4 w-4 text-leaf" /> Open to {activity.professional.openTo.join(' & ')}
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {reputation.badges.map((b) => (
              <span key={b.id} className="rounded-full bg-ivory px-2.5 py-1 text-[0.7rem] font-medium text-navy-soft">
                {b.label}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
