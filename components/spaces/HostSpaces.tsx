'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { DoorOpen, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PlanOptions } from '@/components/pricing/PlanOptions'
import { Dialog } from '@/components/ui/Dialog'
import { Select, TextArea, TextField } from '@/components/ui/fields'
import { Button, Card } from '@/components/ui/primitives'
import { HOSTED_SPACES } from '@/lib/config'
import { hostedBy, roomHref, validateNewSpace, PLACES_HREF } from '@/lib/spaces/rooms'
import { spacesBackend, spacesStore, useOccupancy, useSpaces } from '@/lib/spaces/store'
import { HOSTED_ROOM_TYPES, SpaceError, type RoomType } from '@/lib/spaces/types'
import { canHostSpaces } from '@/lib/store/actions'
import { settled } from '@/lib/store/cloud/sync'
import { useWorld, withAuth } from '@/lib/store/hooks'
import { toast } from '@/lib/ui'
import { SpaceCard } from './SpaceCard'

/** Members' own rooms: "Host a space", and the rooms you host. */
export function HostSpaces() {
  const world = useWorld()
  const router = useRouter()
  const wantsHost = useSearchParams().get('host') === '1'
  const spaces = useSpaces()
  const occupancy = useOccupancy()
  const [open, setOpen] = useState(false)
  const all = 'data' in spaces && spaces.data ? spaces.data : []
  const mine = hostedBy(all, world.accountId)
  const others = all.filter((s) => !s.isOfficial && s.isActive && s.createdBy !== world.accountId)
  const canHost = canHostSpaces(world)

  // Arriving from "+ Create → Host a space".
  useEffect(() => {
    if (!wantsHost) return
    router.replace(PLACES_HREF)
    withAuth(() => setOpen(true), 'Join PLACES FOR US to create a Virtual Place.')
  }, [wantsHost, router])

  return (
    <section className="mt-12" aria-labelledby="host">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="host" className="font-serif text-[1.9rem] leading-tight">
            {mine.length ? 'Your Virtual Places' : 'Create a Virtual Place'}
          </h2>
          <p className="text-navy-soft">Meetings, classes, study groups, masterminds and gatherings — with a link people can join.</p>
        </div>
        <Button onClick={() => withAuth(() => setOpen(true), 'Join PLACES FOR US to create a Virtual Place.')}>
          <Plus className="h-4 w-4" /> Create a Virtual Place
        </Button>
      </div>

      {mine.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {mine.map((s) => (
            <div key={s.id} className="relative">
              <SpaceCard space={s} count={occupancy ? (occupancy[s.id] ?? 0) : null} size="md" />
              <button
                onClick={() =>
                  confirm(`Remove “${s.name}”? People in it will be asked to leave.`) &&
                  spacesBackend
                    .deleteSpace(s.id)
                    .then(() => {
                      spacesStore.refresh()
                      toast('Room removed.')
                    })
                    .catch((e: Error) => toast(e.message, 'error'))
                }
                aria-label={`Remove ${s.name}`}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-navy shadow-soft hover:text-coral"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <>
          <h3 className="mb-3 mt-8 font-serif text-2xl">Virtual Places from members</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {others.map((s) => (
              <SpaceCard key={s.id} space={s} count={occupancy ? (occupancy[s.id] ?? 0) : null} size="md" />
            ))}
          </div>
        </>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={canHost ? 'Create a Virtual Place' : 'Create your own Virtual Places'}
        description={canHost ? `Each Virtual Place holds up to ${HOSTED_SPACES.maxParticipants} people for now. You can create up to ${HOSTED_SPACES.roomsPerHost}.` : 'Official Virtual Places are always free to join. Creating your own takes a plan.'}
        className={canHost ? undefined : 'md:!max-w-3xl'}
      >
        {canHost ? <NewSpaceForm onDone={(slug) => (setOpen(false), router.push(roomHref(slug)))} /> : <PlanOptions context="space" />}
      </Dialog>
    </section>
  )
}

function NewSpaceForm({ onDone }: { onDone: (slug: string) => void }) {
  const [f, setF] = useState({ name: '', description: '', type: HOSTED_ROOM_TYPES[0].label, capacity: '8' })
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const input = {
      name: f.name,
      description: f.description,
      roomType: (HOSTED_ROOM_TYPES.find((t) => t.label === f.type)?.type ?? 'meeting') as RoomType,
      maxParticipants: Number(f.capacity),
    }
    const problem = validateNewSpace(input, HOSTED_SPACES.maxParticipants)
    if (problem) return toast(problem, 'error')
    setBusy(true)
    try {
      await settled() // a plan started a moment ago is saved before the database checks it
      const space = await spacesBackend.createSpace(input)
      spacesStore.refresh()
      toast(`${space.name} is open.`)
      onDone(space.slug)
    } catch (err) {
      toast(err instanceof SpaceError ? err.message : 'We couldn’t create your Virtual Place. Please try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} required placeholder="e.g. Sunday Writers’ Circle" />
      <TextArea label="What’s it for?" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={280} rows={2} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Kind of room" options={HOSTED_ROOM_TYPES.map((t) => t.label)} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} />
        <TextField label="Capacity" type="number" min={2} max={HOSTED_SPACES.maxParticipants} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
      </div>
      <Card className="flex items-center gap-3 bg-ivory/60 p-3 text-sm text-navy-soft">
        <DoorOpen className="h-5 w-5 shrink-0 text-teal-deep" /> Any PLACES member with the link can join while there’s room.
      </Card>
      <Button type="submit" size="lg" disabled={busy} className="w-full !text-base">
        {busy ? 'Creating…' : 'Create my Virtual Place'}
      </Button>
    </form>
  )
}
