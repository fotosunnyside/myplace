'use client'

import Link from 'next/link'
import { ArrowRight, DoorOpen, Pencil, Users } from 'lucide-react'
import { Card, ButtonLink } from '@/components/ui/primitives'
import { RoomBackdrop } from '@/components/spaces/RoomBackdrop'
import { RoomStatus } from '@/components/spaces/SpaceCard'
import { peopleHere } from '@/lib/spaces/rooms'
import { useOccupancy, useSpaces } from '@/lib/spaces/store'
import { AdminGate } from './AdminGate'

/** /admin — the PLACES admin dashboard. */
export function AdminHome() {
  const spaces = useSpaces()
  const occupancy = useOccupancy()
  const list = spaces.status === 'ready' ? spaces.data : []
  const live = list.filter((s) => s.isActive).length
  const inside = occupancy ? Object.values(occupancy).reduce((a, b) => a + b, 0) : null

  return (
    <AdminGate title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/spaces" className="group">
          <Card lift className="flex h-full flex-col p-6">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-teal-wash text-teal-deep">
              <DoorOpen className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-serif text-2xl">Virtual Places</h2>
            <p className="mt-1 text-navy-soft">Official rooms: names, capacity, backgrounds, cameras and microphones, open or closed.</p>
            <p className="mt-4 text-sm text-muted">
              {spaces.status === 'ready' ? `${list.length} rooms · ${live} live${inside != null ? ` · ${peopleHere(inside).replace(' here', ' inside')}` : ''}` : 'Loading…'}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-medium text-teal-deep">
              Manage rooms <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Card>
        </Link>
      </div>
    </AdminGate>
  )
}

/** /admin/spaces — every official room at a glance. */
export function AdminSpaces() {
  const spaces = useSpaces()
  const occupancy = useOccupancy()
  const list = spaces.status === 'ready' ? spaces.data.filter((s) => s.isOfficial) : []

  return (
    <AdminGate title="Virtual Places" back={{ href: '/admin', label: 'Dashboard' }}>
      <p className="-mt-4 mb-6 max-w-2xl text-navy-soft">Changes save to the database and reach everyone immediately — open rooms and YourPlace update live.</p>
      {spaces.status === 'loading' && <div className="h-40 animate-pulse rounded-panel bg-white/60" />}
      {spaces.status === 'error' && <p className="rounded-panel bg-white/70 p-6 text-center text-muted">{spaces.message}</p>}
      <ul className="grid gap-4">
        {list.map((s) => (
          <li key={s.id}>
            <Card className="grid overflow-hidden md:grid-cols-[260px_1fr]">
              <div className="relative aspect-[16/9] md:aspect-auto md:min-h-[170px]">
                <RoomBackdrop space={s} dim={false} fit="cover" />
                <RoomStatus live={s.isActive} className="absolute left-3 top-3" />
              </div>
              <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <h2 className="font-serif text-2xl">{s.name}</h2>
                  <p className="truncate text-sm text-navy-soft">{s.description}</p>
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <div className="flex gap-1.5">
                      <dt className="text-muted">Status</dt>
                      <dd className="font-medium">{s.isActive ? 'Live' : 'Closed'}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted">Capacity</dt>
                      <dd className="font-medium" data-testid="admin-capacity">
                        {s.maxParticipants}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="text-muted">
                        <Users className="h-3.5 w-3.5" aria-label="Inside now" />
                      </dt>
                      <dd className="font-medium">{occupancy ? (occupancy[s.id] ?? 0) : '—'}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted">Cameras / mics</dt>
                      <dd className="font-medium">
                        {s.allowCamera ? 'On' : 'Off'} / {s.allowMicrophone ? 'On' : 'Off'}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted">Background</dt>
                      <dd className="font-medium">{s.backgroundStyle === 'custom' ? 'Custom' : s.backgroundStyle === 'none' ? 'None' : 'Default'}</dd>
                    </div>
                  </dl>
                </div>
                <ButtonLink href={`/admin/spaces/edit/?id=${s.id}`} variant="outline" className="shrink-0" aria-label={`Edit ${s.name}`}>
                  <Pencil className="h-4 w-4" /> Edit room
                </ButtonLink>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </AdminGate>
  )
}
