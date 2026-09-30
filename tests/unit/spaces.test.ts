import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpacesBackend } from '@/lib/spaces/backend'
import { layoutBubbles } from '@/lib/spaces/layout'
import { MediaDeviceError, type MediaParticipant, type MediaProvider } from '@/lib/spaces/media/types'
import { PREVIEW_SPACES } from '@/lib/spaces/preview'
import { featuredSpaces, hostedBy, peopleHere, roomBackground, roomBehaviour, slugFor, validateNewSpace, validatePatch, checkBackgroundFile } from '@/lib/spaces/rooms'
import { patchToRow, spaceErrorCode, spaceFromRow, type SpaceRow } from '@/lib/spaces/rows'
import { RoomSession } from '@/lib/spaces/session'
import { SpaceError, type RoomMessage, type RoomMusic, type SpacePresence, type VirtualSpace } from '@/lib/spaces/types'
import { distance, LEAVE_DISTANCE, MAX_CONNECTIONS, nearby, startingSpot, step, TALK_DISTANCE } from '@/lib/spaces/proximity'

const [townHall, accountability] = PREVIEW_SPACES

describe('room configuration', () => {
  it('maps database rows, including settings, without trusting unknown room types', () => {
    const row: SpaceRow = {
      id: 'x', name: 'Town Hall', slug: 'town-hall', description: 'd', room_type: 'nonsense', visibility: 'members', background_style: 'custom',
      background_url: 'https://cdn/x.webp', background_path: 'x/1.webp', background_focus_x: 30, background_focus_y: 70, max_participants: 25,
      is_active: true, allow_camera: false, allow_microphone: true, is_official: true, sort_order: 1, parent_space_id: null, instance_number: 1,
      settings: { speaking_mode: 'moderated', welcome: 'Hi', start_muted: true }, created_by: null, created_at: '', updated_at: '',
    }
    const s = spaceFromRow(row)
    expect(s).toMatchObject({ roomType: 'social', maxParticipants: 25, allowCamera: false, focusX: 30, settings: { speakingMode: 'moderated', welcome: 'Hi', startMuted: true } })
  })

  it('only sends admin-editable columns', () => {
    const row = patchToRow({ name: 'A', maxParticipants: 30, isActive: false, ...({ isOfficial: false, createdBy: 'me' } as object) })
    expect(row).toEqual({ name: 'A', max_participants: 30, is_active: false })
  })

  it('validates capacity and names like the database does', () => {
    expect(validatePatch({ maxParticipants: 25 })).toEqual({})
    expect(validatePatch({ maxParticipants: 1 }).maxParticipants).toBeTruthy()
    expect(validatePatch({ maxParticipants: 501 }).maxParticipants).toBeTruthy()
    expect(validatePatch({ maxParticipants: 12.5 }).maxParticipants).toBeTruthy()
    expect(validatePatch({ maxParticipants: NaN }).maxParticipants).toBeTruthy()
    expect(validatePatch({ name: '  ' }).name).toBeTruthy()
    expect(validatePatch({ description: 'x'.repeat(281) }).description).toBeTruthy()
  })

  it('accepts only web image formats for backgrounds', () => {
    expect(checkBackgroundFile({ type: 'image/webp', size: 1000 })).toBeNull()
    expect(checkBackgroundFile({ type: 'image/png', size: 1000 })).toBeNull()
    expect(checkBackgroundFile({ type: 'image/gif', size: 1000 })).toMatch(/JPEG, PNG or WebP/)
    expect(checkBackgroundFile({ type: 'image/jpeg', size: 30 * 1024 * 1024 })).toMatch(/20 MB/)
  })

  it('resolves backgrounds from configuration, not from the room slug', () => {
    expect(roomBackground({ ...townHall, backgroundStyle: 'custom', backgroundUrl: 'https://x/y.webp' })).toMatchObject({ kind: 'image', src: 'https://x/y.webp', isDefault: false })
    expect(roomBackground({ ...townHall, backgroundStyle: 'none' })).toEqual({ kind: 'none' })
    const renamed = roomBackground({ ...accountability, slug: 'anything' } as VirtualSpace)
    expect(renamed).toMatchObject({ kind: 'image', isDefault: true, src: '/districts/mindplace-banner.webp' })
  })

  it('derives calls to action and quiet arrival from the room type', () => {
    expect(roomBehaviour(townHall).cta).toBe('Enter Town Hall')
    expect(roomBehaviour({ ...townHall, name: 'Main Square' }).cta).toBe('Enter Main Square')
    expect(roomBehaviour(accountability)).toMatchObject({ cta: 'Start Working', quiet: true, startWithMic: false, startWithCamera: true })
    expect(roomBehaviour({ ...townHall, allowCamera: false }).startWithCamera).toBe(false)
  })

  it('features top-level official rooms only, in their configured order', () => {
    const overflow = { ...townHall, id: 'o', slug: 'town-hall-2', name: 'Town Hall 2', parentSpaceId: townHall.id, instanceNumber: 2 }
    const member = { ...townHall, id: 'm', slug: 'mine', isOfficial: false }
    expect(featuredSpaces([accountability, overflow, member, townHall]).map((s) => s.slug)).toEqual(['town-hall', 'accountability-room'])
  })

  it('never fakes counts', () => {
    expect(peopleHere(12)).toBe('12 people here')
    expect(peopleHere(1)).toBe('1 person here')
    expect(peopleHere(0)).toBe('No one here yet')
  })

  it('maps database errors to room states', () => {
    expect(spaceErrorCode({ code: 'PLC04' })).toBe('full')
    expect(spaceErrorCode({ code: 'PLC03' })).toBe('closed')
    expect(spaceErrorCode({ message: 'new row violates row-level security policy' })).toBe('forbidden')
    expect(spaceErrorCode({ message: 'TypeError: Failed to fetch' })).toBe('network')
  })
})

describe('bubble layout', () => {
  const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }))
  const overlap = (spots: { x: number; y: number; size: number }[]) => {
    let worst = 0
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) {
        const d = Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)
        worst = Math.max(worst, spots[i].size - d)
      }
    return worst
  }

  it('centres one person and keeps a crowd inside the stage without piling up', () => {
    const one = layoutBubbles(people(1), 1200, 700, { minSize: 76, maxSize: 184 })
    expect(one.spots[0]).toMatchObject({ x: 600, y: 350, size: 184 })
    for (const [w, h] of [
      [1200, 700],
      [390, 560],
    ]) {
      const r = layoutBubbles(people(20), w, h, { minSize: 56, maxSize: 184 })
      expect(r.spots).toHaveLength(20)
      expect(overlap(r.spots)).toBeLessThan(r.size * 0.1)
      for (const s of r.spots) {
        expect(s.x - s.size / 2).toBeGreaterThanOrEqual(-1)
        expect(s.x + s.size / 2).toBeLessThanOrEqual(w + 1)
      }
    }
  })

  it('keeps everyone in their spot when someone new arrives', () => {
    const before = layoutBubbles(people(5), 1000, 600, { minSize: 60, maxSize: 120 })
    const after = layoutBubbles(people(6), 1000, 600, { minSize: 60, maxSize: 120 })
    if (after.size === before.size) expect(after.spots.slice(0, 5)).toEqual(before.spots)
  })

  it('lets very full rooms scroll instead of shrinking people to dots', () => {
    const r = layoutBubbles(people(120), 360, 500, { minSize: 56, maxSize: 128 })
    expect(r.size).toBe(56)
    expect(r.height).toBeGreaterThan(500)
  })

  it('gathers each zone around its own spot', () => {
    const r = layoutBubbles([{ id: 'a', zone: 'x' }, { id: 'b', zone: 'y' }], 1000, 600, { minSize: 60, maxSize: 120 })
    expect(r.spots[0].x).toBeLessThan(500)
    expect(r.spots[1].x).toBeGreaterThan(500)
  })
})

/* ------------------------------------------------------------------ */
/* Room session                                                          */
/* ------------------------------------------------------------------ */

class FakeMedia implements MediaProvider {
  peers: string[] = []
  setPeers(ids: string[]) {
    this.peers = ids
  }
  name = 'fake'
  carriesRemoteMedia = false
  needsToken = false
  state: MediaProvider['state'] = 'disconnected'
  localParticipant: MediaParticipant | null = null
  remoteParticipants: MediaParticipant[] = []
  cameraError: MediaDeviceError | null = null
  micError: MediaDeviceError | null = null
  private ls = new Set<() => void>()
  subscribe(l: () => void) {
    this.ls.add(l)
    return () => this.ls.delete(l)
  }
  private emit() {
    this.ls.forEach((l) => l())
  }
  async connectToRoom(o: { identity: string; name: string }) {
    this.state = 'connected'
    this.localParticipant = { identity: o.identity, name: o.name, isLocal: true, cameraOn: false, micOn: false, speaking: false, videoStream: null, audioStream: null }
    this.emit()
  }
  async disconnectFromRoom() {
    this.state = 'disconnected'
    this.localParticipant = null
    this.emit()
  }
  async enableCamera() {
    if (this.cameraError) throw this.cameraError
    this.localParticipant = { ...this.localParticipant!, cameraOn: true }
    this.emit()
  }
  async disableCamera() {
    this.localParticipant = this.localParticipant && { ...this.localParticipant, cameraOn: false }
    this.emit()
  }
  async unmuteMicrophone() {
    if (this.micError) throw this.micError
    this.localParticipant = { ...this.localParticipant!, micOn: true }
    this.emit()
  }
  async muteMicrophone() {
    this.localParticipant = this.localParticipant && { ...this.localParticipant, micOn: false }
    this.emit()
  }
}

function fakeBackend(opts: { capacity?: number; others?: number } = {}) {
  const room = new Map<string, SpacePresence>()
  for (let i = 0; i < (opts.others ?? 0); i++) room.set(`o${i}`, { userId: `o${i}`, displayName: `Other ${i}`, avatarUrl: null, cameraOn: false, micOn: false, zone: null, x: 0.5, y: 0.5 + i * 0.05, scale: null, status: null, role: 'participant', joinedAt: `0${i}`, lastSeenAt: '' })
  const state = { online: true, admitted: true, closed: false, capacity: opts.capacity ?? 20, touches: [] as { cameraOn: boolean; micOn: boolean }[], left: 0, moves: [] as { x: number; y: number }[], chat: [] as ((m: RoomMessage) => void)[], music: null as RoomMusic | null }
  const b: SpacesBackend = {
    mode: 'preview',
    listSpaces: async () => PREVIEW_SPACES,
    onSpacesChange: () => () => {},
    occupancy: async () => ({}),
    onOccupancyChange: () => () => {},
    roster: async () => [...room.values()],
    onRosterChange: () => () => {},
    identity: () => 'me',
    async join(_id, me) {
      if (!state.online) throw new SpaceError('network', 'offline')
      if (state.closed) throw new SpaceError('closed', 'This room is currently closed.')
      if (!room.has('me') && room.size >= state.capacity) throw new SpaceError('full', 'This room is currently full.')
      room.set('me', { userId: 'me', displayName: me.name, avatarUrl: null, cameraOn: false, micOn: false, zone: null, x: room.get('me')?.x ?? null, y: room.get('me')?.y ?? null, scale: null, status: null, role: 'participant', joinedAt: '9', lastSeenAt: '' })
      state.admitted = true
    },
    async touch(_id, s) {
      if (!state.online) throw new SpaceError('network', 'offline')
      state.touches.push(s)
      return state.admitted && !state.closed
    },
    async leave() {
      state.left++
      room.delete('me')
    },
    async move(_id, x, y) {
      const mine = room.get('me')
      if (mine) room.set('me', { ...mine, x, y })
      state.moves.push({ x, y })
    },
    async setLook(_id, scale, status) {
      const mine = room.get('me')
      if (mine) room.set('me', { ...mine, scale, status })
    },
    music: async () => state.music,
    onMusic: () => () => {},
    tracks: async () => [],
    async setMusic(_id, trackId) {
      state.music = trackId ? { trackId, title: 'Morning Focus', artist: 'PLACES', url: 'https://example.com/a.mp3', durationS: 180, startedBy: 'me', startedAt: '' } : null
    },
    messages: async () => [],
    onMessage: (_id, cb) => {
      state.chat.push(cb)
      return () => {}
    },
    async sendMessage(_id, body) {
      if (!room.has('me')) throw new SpaceError('forbidden', 'Enter the room to chat.')
      return { id: `m${state.moves.length}${body.length}`, userId: 'me', name: 'Josie Rivers', body, createdAt: '' }
    },
    signal: async () => {},
    onSignal: () => () => {},
    mediaToken: async () => null,
    createSpace: async () => {
      throw new SpaceError('forbidden', 'no')
    },
    deleteSpace: async () => {},
    updateSpace: async () => townHall,
    uploadBackground: async () => ({ url: '', path: '' }),
    removeBackgroundObject: async () => {},
  }
  return { backend: b, state, room }
}

describe('talking distance', () => {
  it('connects the people near you, nearest first, and lets go with a little slack', () => {
    const me = { x: 0.5, y: 0.5 }
    const others = [
      { id: 'far', x: 0.95, y: 0.9 },
      { id: 'near', x: 0.55, y: 0.5 },
      { id: 'edge', x: 0.5, y: 0.5 + (TALK_DISTANCE + LEAVE_DISTANCE) / 2 },
      { id: 'unplaced', x: null, y: null },
    ]
    expect(nearby(me, others)).toEqual(['near'])
    // Already talking to someone at the edge: stay connected until they're past the leaving distance.
    expect(nearby(me, others, new Set(['edge']))).toEqual(['near', 'edge'])
    expect(nearby(null, others)).toEqual([])
  })

  it('agrees whoever measures, and caps the number of connections', () => {
    const a = { x: 0.2, y: 0.3 }
    const b = { x: 0.4, y: 0.6 }
    expect(distance(a, b)).toBeCloseTo(distance(b, a))
    const crowd = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, x: 0.5 + (i % 5) * 0.01, y: 0.5 + Math.floor(i / 5) * 0.01 }))
    expect(nearby({ x: 0.5, y: 0.5 }, crowd)).toHaveLength(MAX_CONNECTIONS)
  })

  it('places newcomers near the others without sitting on anyone', () => {
    const first = startingSpot([])
    expect(first).toEqual({ x: 0.5, y: 0.52 })
    const taken = [first]
    for (let i = 0; i < 6; i++) taken.push(startingSpot(taken))
    for (let i = 1; i < taken.length; i++) {
      const gaps = taken.slice(0, i).map((t) => distance(t, taken[i]))
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0.24) // side by side, not on top of anyone
      expect(Math.min(...gaps)).toBeLessThan(TALK_DISTANCE) // and close enough to talk to someone
    }
    expect(distance(first, taken[1])).toBeLessThan(TALK_DISTANCE)
  })

  it('walks with the arrow keys and stays inside the room', () => {
    expect(step({ x: 0.5, y: 0.5 }, 'ArrowUp')).toEqual({ x: 0.5, y: 0.46 })
    expect(step({ x: 0.94, y: 0.5 }, 'ArrowRight')!.x).toBe(0.94)
    expect(step({ x: 0.5, y: 0.5 }, 'Enter')).toBeNull()
  })
})

describe('room session', () => {
  let media: FakeMedia
  let watchers: ((s: VirtualSpace | null) => void)[]
  const make = (backend: SpacesBackend) => {
    media = new FakeMedia()
    watchers = []
    return new RoomSession({
      backend,
      createMedia: () => media,
      watchSpace: (_id, cb) => {
        watchers.push(cb)
        return () => {}
      },
    })
  }
  const me = { name: 'Josie Rivers' }
  const settle = () => new Promise((r) => setTimeout(r, 0))

  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }))
  afterEach(() => vi.useRealTimers())

  it('enters, turns on the camera and mic it was asked for, and reports them to presence', async () => {
    const { backend, state } = fakeBackend()
    const s = make(backend)
    await s.enter(townHall, me, { camera: true, mic: true })
    expect(s.get()).toMatchObject({ phase: 'in-room', camera: 'on', mic: 'on', carriesRemoteMedia: false })
    await settle()
    expect(state.touches.at(-1)).toEqual({ cameraOn: true, micOn: true })
  })

  it('turns people away when the room is full, using the configured capacity', async () => {
    const { backend } = fakeBackend({ capacity: 3, others: 3 })
    const s = make(backend)
    await s.enter({ ...townHall, maxParticipants: 3 }, me, { camera: false, mic: false })
    expect(s.get()).toMatchObject({ phase: 'full', message: 'This room is currently full.' })
  })

  it('does not let people into a closed room', async () => {
    const { backend } = fakeBackend()
    const s = make(backend)
    await s.enter({ ...townHall, isActive: false }, me, { camera: false, mic: false })
    expect(s.get().phase).toBe('closed')
  })

  it('keeps going audio-only when the camera is denied', async () => {
    const { backend } = fakeBackend()
    const s = make(backend)
    media.cameraError = new MediaDeviceError('camera', 'denied')
    await s.enter(townHall, me, { camera: true, mic: true })
    expect(s.get()).toMatchObject({ phase: 'in-room', camera: 'denied', mic: 'on' })
  })

  it('reports a denied microphone without crashing', async () => {
    const { backend } = fakeBackend()
    const s = make(backend)
    media.micError = new MediaDeviceError('microphone', 'denied')
    await s.enter(townHall, me, { camera: false, mic: true })
    expect(s.get()).toMatchObject({ phase: 'in-room', mic: 'denied' })
  })

  it('respects room policy: no camera when the room turns cameras off, even mid-visit', async () => {
    const { backend } = fakeBackend()
    const s = make(backend)
    await s.enter({ ...townHall, allowCamera: false }, me, { camera: true, mic: false })
    expect(s.get().camera).toBe('blocked')
    await s.setCamera(true)
    expect(s.get().camera).toBe('blocked')

    const s2 = make(fakeBackend().backend)
    await s2.enter(townHall, me, { camera: true, mic: false })
    expect(s2.get().camera).toBe('on')
    watchers.forEach((w) => w({ ...townHall, allowCamera: false, name: 'Town Square' }))
    expect(s2.get()).toMatchObject({ camera: 'blocked', space: { name: 'Town Square' } })
  })

  it('sends everyone out when an admin closes the room', async () => {
    const { backend } = fakeBackend()
    const s = make(backend)
    await s.enter(townHall, me, { camera: false, mic: false })
    watchers.forEach((w) => w({ ...townHall, isActive: false }))
    expect(s.get().phase).toBe('closed')
    expect(media.state).toBe('disconnected')
  })

  it('reconnects after a dropped connection, and gives up after a minute', async () => {
    const { backend, state } = fakeBackend()
    const s = make(backend)
    await s.enter(townHall, me, { camera: false, mic: false })
    state.online = false
    await vi.advanceTimersByTimeAsync(15_000)
    expect(s.get().phase).toBe('reconnecting')
    state.online = true
    await vi.advanceTimersByTimeAsync(15_000)
    expect(s.get().phase).toBe('in-room')

    state.online = false
    await vi.advanceTimersByTimeAsync(90_000)
    expect(s.get().phase).toBe('lost')
  })

  it('takes its place back after timing out, or explains why it cannot', async () => {
    const { backend, state, room } = fakeBackend({ capacity: 2 })
    const s = make(backend)
    await s.enter(townHall, me, { camera: false, mic: false })
    state.admitted = false
    await vi.advanceTimersByTimeAsync(15_000)
    expect(s.get().phase).toBe('in-room')

    // Someone took the last place while we were away.
    state.admitted = false
    room.delete('me')
    room.set('x', { ...room.values().next().value!, userId: 'x' })
    room.set('y', { ...room.values().next().value!, userId: 'y' })
    await vi.advanceTimersByTimeAsync(15_000)
    expect(s.get().phase).toBe('full')
  })

  it('stays in the room across page changes, and leaving gives the place back', async () => {
    const { backend, state } = fakeBackend()
    const s = make(backend)
    await s.enter(townHall, me, { camera: false, mic: false })
    await s.enter(townHall, me, { camera: false, mic: false }) // coming back to the room page
    expect(state.left).toBe(0)
    expect(s.get().phase).toBe('in-room')
    await s.leave()
    expect(state.left).toBe(1)
    expect(s.get().phase).toBe('idle')
  })
})

describe('rooms members host', () => {
  const hosted: VirtualSpace = { ...townHall, id: 'h1', name: 'Writers', slug: 'writers-abc123', isOfficial: false, createdBy: 'u1', sortOrder: 100 }

  it('lists a host’s own rooms, never the official ones', () => {
    expect(hostedBy([townHall, accountability, hosted], 'u1').map((s) => s.id)).toEqual(['h1'])
    expect(hostedBy([townHall, hosted], 'someone-else')).toEqual([])
    expect(hostedBy([hosted], null)).toEqual([])
    expect(featuredSpaces([townHall, hosted]).map((s) => s.id)).toEqual([townHall.id])
  })

  it('gives each new room a readable, unique address the database accepts', () => {
    const a = slugFor('Sunday Writers’ Circle!')
    expect(a).toMatch(/^sunday-writers-circle-[a-z0-9]{6}$/)
    expect(a).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    expect(slugFor('!!!')).toMatch(/^room-[a-z0-9]{6}$/)
    expect(slugFor('Sunday Writers’ Circle!')).not.toBe(a)
  })

  it('keeps hosted rooms within the starting limits', () => {
    const ok = { name: 'Writers', description: '', roomType: 'meeting' as const, maxParticipants: 8 }
    expect(validateNewSpace(ok, 12)).toBeNull()
    expect(validateNewSpace({ ...ok, name: '  ' }, 12)).toMatch(/name/)
    expect(validateNewSpace({ ...ok, maxParticipants: 13 }, 12)).toMatch(/2 to 12/)
    expect(validateNewSpace({ ...ok, maxParticipants: 1 }, 12)).toMatch(/2 to 12/)
  })

  it('names the official rooms the way PLACES describes them', () => {
    expect(accountability.name).toBe('Accountability Department')
    expect(townHall.description).toMatch(/Meet people/)
  })
})

describe('room session, together', () => {
  const settle = () => new Promise((r) => setTimeout(r, 0))
  const make = (backend: SpacesBackend, media: FakeMedia) => new RoomSession({ backend, createMedia: () => media, watchSpace: () => () => {} })

  it('stands newcomers near the others and connects them to whoever is within talking distance', async () => {
    const { backend, state, room } = fakeBackend({ others: 2 })
    const media = new FakeMedia()
    const s = make(backend, media)
    await s.enter(townHall, { name: 'Josie Rivers' }, { camera: false, mic: false })
    await settle()
    await settle()
    expect(state.moves).toHaveLength(1)
    const mine = room.get('me')!
    expect(mine.x).not.toBeNull()
    expect(s.get().nearby.sort()).toEqual(['o0', 'o1'])
    expect(media.peers.sort()).toEqual(['o0', 'o1'])

    // Walk away to the far corner: the connections close.
    await s.move({ x: 0.02, y: 0.02 })
    expect(s.get().nearby).toEqual([])
    expect(media.peers).toEqual([])
    expect(state.moves.at(-1)).toEqual({ x: 0.02, y: 0.02 })
    await s.leave()
  })

  it('keeps talking with someone who drops out of one roster read, and lets go once they are really gone', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    try {
      const { backend, room } = fakeBackend({ others: 1 })
      const media = new FakeMedia()
      const s = make(backend, media)
      await s.enter(townHall, { name: 'Josie Rivers' }, { camera: false, mic: false })
      await settle()
      await settle()
      expect(media.peers).toEqual(['o0'])

      // A late heartbeat: they're missing from the next roster read, then back. The call stays up.
      const other = room.get('o0')!
      room.delete('o0')
      await vi.advanceTimersByTimeAsync(10_000)
      expect(media.peers).toEqual(['o0'])
      room.set('o0', other)
      await vi.advanceTimersByTimeAsync(10_000)
      expect(media.peers).toEqual(['o0'])

      // Really gone: the call ends after the grace period.
      room.delete('o0')
      await vi.advanceTimersByTimeAsync(20_000)
      expect(media.peers).toEqual(['o0'])
      await vi.advanceTimersByTimeAsync(20_000)
      expect(media.peers).toEqual([])
      await s.leave()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows chat as it arrives, once each', async () => {
    const { backend, state } = fakeBackend()
    const s = make(backend, new FakeMedia())
    await s.enter(townHall, { name: 'Josie Rivers' }, { camera: false, mic: false })
    await s.say('Hello room')
    const incoming: RoomMessage = { id: 'x1', userId: 'o0', name: 'Other', body: 'Hi Josie', createdAt: '' }
    state.chat.forEach((cb) => cb(incoming))
    state.chat.forEach((cb) => cb(incoming))
    expect(s.get().messages.map((m) => m.body)).toEqual(['Hello room', 'Hi Josie'])
    await s.leave()
    expect(s.get().messages).toEqual([])
  })
})

describe('room session, your bubble and music', () => {
  const make = (backend: SpacesBackend) => new RoomSession({ backend, createMedia: () => new FakeMedia(), watchSpace: () => () => {} })

  it('sets your bubble size and status for everyone, and keeps sizes even where resizing is off', async () => {
    const { backend, room } = fakeBackend()
    const s = make(backend)
    await s.enter(townHall, { name: 'Josie Rivers' }, { camera: false, mic: false })
    await s.setLook({ scale: 1.4, status: '  Heads down until 3  ' })
    expect(room.get('me')).toMatchObject({ scale: 1.4, status: 'Heads down until 3' })
    expect(s.get().roster.find((p) => p.userId === 'me')).toMatchObject({ scale: 1.4, status: 'Heads down until 3' })
    await s.setLook({ status: null })
    expect(room.get('me')).toMatchObject({ scale: 1.4, status: null })
    await s.leave()

    const fixed = make(backend)
    await fixed.enter({ ...townHall, allowResize: false }, { name: 'Josie Rivers' }, { camera: false, mic: false })
    await fixed.setLook({ scale: 1.6 })
    expect(fixed.get().roster.find((p) => p.userId === 'me')?.scale).toBeNull()
    await fixed.leave()
  })

  it('plays and stops music for the room', async () => {
    const { backend } = fakeBackend()
    const s = make(backend)
    await s.enter(townHall, { name: 'Josie Rivers' }, { camera: false, mic: false })
    await s.setMusic('trk-1')
    await new Promise((r) => setTimeout(r, 0))
    expect(s.get().music).toMatchObject({ trackId: 'trk-1', title: 'Morning Focus' })
    await s.setMusic(null)
    await new Promise((r) => setTimeout(r, 0))
    expect(s.get().music).toBeNull()
    await s.leave()
  })
})
