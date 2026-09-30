import { HEARTBEAT_MS, type SpacesBackend } from './backend'
import { DeviceMediaProvider } from './media/device'
import { MediaDeviceError, type MediaParticipant, type MediaProvider } from './media/types'
import { nearby, startingSpot, type Spot } from './proximity'
import { SPACE_MESSAGES, SpaceError, type RoomMessage, type RoomMusic, type SpaceErrorCode, type SpacePresence, type VirtualSpace } from './types'

/**
 * A person's visit to one Virtual Space: admission, presence heartbeat, media and recovery.
 *
 * Lives outside React so walking over to another Place doesn't drop you from the room — you stay
 * until you leave. Every backend and media call goes through injected interfaces.
 */

export type RoomPhase =
  | 'idle'
  | 'joining' // asking the backend for a place (capacity-checked)
  | 'connecting' // connecting media
  | 'in-room'
  | 'reconnecting'
  | 'lost' // gave up reconnecting; can try again
  | 'signin'
  | 'missing'
  | 'closed'
  | 'full'
  | 'error'

/** off · requesting permission · on · denied by the person · no device · busy elsewhere · switched off by the room */
export type DeviceState = 'off' | 'requesting' | 'on' | 'denied' | 'unavailable' | 'in-use' | 'blocked'

export interface RoomSessionState {
  phase: RoomPhase
  space: VirtualSpace | null
  message?: string
  camera: DeviceState
  mic: DeviceState
  roster: SpacePresence[]
  local: MediaParticipant | null
  remote: MediaParticipant[]
  /** False until a live video provider is connected. */
  carriesRemoteMedia: boolean
  me: string | null
  /** The room's chat, oldest first. */
  messages: RoomMessage[]
  /** People close enough to see and hear (person-to-person connections). */
  nearby: string[]
  /** Music playing in the room, if any. */
  music: RoomMusic | null
}

export interface SessionDeps {
  backend: SpacesBackend
  createMedia: () => MediaProvider
  /** Live room configuration: calls back with the latest version of the room (or null if it disappeared). */
  watchSpace: (spaceId: string, cb: (space: VirtualSpace | null) => void) => () => void
}

const IDLE: RoomSessionState = { phase: 'idle', space: null, camera: 'off', mic: 'off', roster: [], local: null, remote: [], carriesRemoteMedia: false, me: null, messages: [], nearby: [], music: null }
const GIVE_UP_AFTER_MS = 60_000
const ROSTER_POLL_MS = 10_000
/** How long to keep talking with someone who briefly vanished from the roster. */
const MISSING_GRACE_MS = 30_000

const endPhase: Partial<Record<SpaceErrorCode, RoomPhase>> = { signin: 'signin', missing: 'missing', closed: 'closed', full: 'full', network: 'lost' }

const deviceState = (e: unknown): DeviceState => {
  if (!(e instanceof MediaDeviceError)) return 'unavailable'
  return e.kind === 'denied' ? 'denied' : e.kind === 'in-use' ? 'in-use' : 'unavailable'
}

export class RoomSession {
  private state: RoomSessionState = IDLE
  private listeners = new Set<() => void>()
  private media: MediaProvider | null = null
  private attempt = 0
  private cleanups: (() => void)[] = []
  private offlineSince: number | null = null
  private missingSince = new Map<string, number>()
  private wantCamera = false
  private wantMic = false
  private touching: Promise<void> | null = null
  private touchAgain = false
  private profile: { name: string; avatar?: string } = { name: 'Someone' }
  /** Where you last stood, so a reconnect puts you back in the same spot. */
  private lastSpot: Spot | null = null

  constructor(private deps: SessionDeps) {}

  get = () => this.state
  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  private set(patch: Partial<RoomSessionState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  get active() {
    return this.state.phase === 'in-room' || this.state.phase === 'reconnecting' || this.state.phase === 'joining' || this.state.phase === 'connecting'
  }

  /** Enter a room. Re-entering the room you're already in is a no-op, so revisiting the page keeps your session. */
  async enter(space: VirtualSpace, me: { name: string; avatar?: string }, prefs: { camera: boolean; mic: boolean }) {
    if (this.active && this.state.space?.id === space.id) return
    if (this.state.space) await this.leave()

    const attempt = ++this.attempt
    this.profile = me
    this.lastSpot = null
    this.wantCamera = prefs.camera
    this.wantMic = prefs.mic
    this.set({ ...IDLE, phase: 'joining', space, camera: space.allowCamera ? 'off' : 'blocked', mic: space.allowMicrophone ? 'off' : 'blocked', me: this.deps.backend.identity() })

    if (!this.deps.backend.identity()) return this.set({ phase: 'signin', message: SPACE_MESSAGES.signin })
    if (!space.isActive) return this.set({ phase: 'closed', message: SPACE_MESSAGES.closed })

    try {
      await this.deps.backend.join(space.id, me)
    } catch (e) {
      if (attempt !== this.attempt) return
      return this.fail(e)
    }
    if (attempt !== this.attempt) return this.deps.backend.leave(space.id).catch(() => {})

    this.set({ phase: 'connecting' })
    this.watch(space)

    let media = this.deps.createMedia()
    try {
      const token = media.needsToken ? await this.deps.backend.mediaToken(space.id) : null
      if (media.needsToken && !token) media = this.fallbackMedia(media)
      if (attempt !== this.attempt) return
      await media.connectToRoom({ spaceId: space.id, identity: this.state.me!, name: me.name, token, signals: this.signalsFor(space.id) })
    } catch (e) {
      if (attempt !== this.attempt) return
      // Presence still works without media; stay in the room with on-device media.
      console.warn('PLACES: live media unavailable, continuing without it', e)
      media = this.fallbackMedia(media)
      await media.connectToRoom({ spaceId: space.id, identity: this.state.me!, name: me.name, token: null })
    }
    if (attempt !== this.attempt) return media.disconnectFromRoom()

    this.media = media
    this.cleanups.push(media.subscribe(() => this.syncMedia()))
    this.set({ phase: 'in-room', carriesRemoteMedia: media.carriesRemoteMedia })
    this.syncMedia()
    this.startHeartbeat(space.id)
    this.startChat(space.id)
    this.startMusic(space.id)
    this.refreshRoster(true)

    if (this.wantCamera && this.state.space?.allowCamera) await this.setCamera(true)
    if (attempt === this.attempt && this.wantMic && this.state.space?.allowMicrophone) await this.setMic(true)
  }

  /** Your own camera and mic still work when live media can't connect. */
  private fallbackMedia(failed: MediaProvider): MediaProvider {
    failed.disconnectFromRoom().catch(() => {})
    return new DeviceMediaProvider()
  }

  async leave() {
    const space = this.state.space
    this.attempt++
    this.teardown()
    const media = this.media
    this.media = null
    this.set(IDLE)
    // Start giving the place back right away, while we still know who we are.
    const left = space ? this.deps.backend.leave(space.id).catch(() => {}) : null
    await media?.disconnectFromRoom().catch(() => {})
    await left
  }

  /** Leave as the page unloads. */
  leaveOnUnload() {
    const space = this.state.space
    if (!space || !this.active) return
    this.deps.backend.leave(space.id, { keepalive: true }).catch(() => {})
  }

  async retry() {
    const space = this.state.space
    if (!space) return
    this.teardown()
    await this.media?.disconnectFromRoom().catch(() => {})
    this.media = null
    this.set({ phase: 'idle' })
    await this.enter(space, this.profile, { camera: this.wantCamera, mic: this.wantMic })
  }

  async toggleCamera() {
    await this.setCamera(this.state.camera !== 'on')
  }

  async toggleMic() {
    await this.setMic(this.state.mic !== 'on')
  }

  /** Walk your circle to a spot (0–1 across and down the room). */
  async move(to: Spot) {
    const space = this.state.space
    const me = this.state.me
    if (!space || !me || this.state.phase !== 'in-room') return
    const x = Math.min(1, Math.max(0, to.x))
    const y = Math.min(1, Math.max(0, to.y))
    this.lastSpot = { x, y }
    this.set({ roster: this.state.roster.map((p) => (p.userId === me ? { ...p, x, y } : p)) })
    this.updatePeers()
    await this.deps.backend.move(space.id, x, y).catch(() => {})
  }

  /** Your bubble's size (null = normal) and status note, for everyone in the room. */
  async setLook(look: { scale?: number | null; status?: string | null }) {
    const space = this.state.space
    const me = this.state.me
    if (!space || !me || this.state.phase !== 'in-room') return
    const mine = this.state.roster.find((p) => p.userId === me)
    const scale = look.scale !== undefined ? look.scale : (mine?.scale ?? null)
    const status = look.status !== undefined ? look.status?.trim().slice(0, 60) || null : (mine?.status ?? null)
    this.set({ roster: this.state.roster.map((p) => (p.userId === me ? { ...p, scale: space.allowResize ? scale : null, status } : p)) })
    await this.deps.backend.setLook(space.id, scale, status).catch(() => {})
  }

  /** Play a YouTube video for the room (PLACES Pass), or stop with null. Throws SpaceError when not allowed. */
  async setMusic(videoId: string | null, title = '') {
    const space = this.state.space
    if (!space) return
    await this.deps.backend.setMusic(space.id, videoId, title)
    this.refreshMusic(space.id)
  }

  /** Say something in the room's chat. Throws SpaceError when it can't be sent. */
  async say(body: string) {
    const space = this.state.space
    if (!space || !body.trim()) return
    const m = await this.deps.backend.sendMessage(space.id, body)
    this.addMessage(m)
  }

  async setCamera(on: boolean) {
    const media = this.media
    if (!media || !this.state.space) return
    if (on && !this.state.space.allowCamera) return this.set({ camera: 'blocked' })
    this.wantCamera = on
    if (!on) {
      await media.disableCamera()
      this.set({ camera: this.state.space.allowCamera ? 'off' : 'blocked' })
    } else {
      this.set({ camera: 'requesting' })
      try {
        await media.enableCamera()
        if (this.media === media) this.set({ camera: 'on' })
      } catch (e) {
        if (this.media === media) this.set({ camera: deviceState(e) })
      }
    }
    this.pushState()
  }

  async setMic(on: boolean) {
    const media = this.media
    if (!media || !this.state.space) return
    if (on && !this.state.space.allowMicrophone) return this.set({ mic: 'blocked' })
    this.wantMic = on
    if (!on) {
      await media.muteMicrophone()
      this.set({ mic: this.state.space.allowMicrophone ? 'off' : 'blocked' })
    } else {
      this.set({ mic: 'requesting' })
      try {
        await media.unmuteMicrophone()
        if (this.media === media) this.set({ mic: 'on' })
      } catch (e) {
        if (this.media === media) this.set({ mic: deviceState(e) })
      }
    }
    this.pushState()
  }

  /* ---------------------------------------------------------------- */

  private fail(e: unknown) {
    const code: SpaceErrorCode = e instanceof SpaceError ? e.code : 'unknown'
    const message = e instanceof SpaceError ? e.message : SPACE_MESSAGES.unknown
    this.teardown()
    const media = this.media
    this.media = null
    media?.disconnectFromRoom().catch(() => {})
    this.set({ phase: endPhase[code] ?? 'error', message, local: null, remote: [], roster: [], camera: 'off', mic: 'off', messages: [], nearby: [], music: null })
  }

  private teardown() {
    this.cleanups.forEach((c) => c())
    this.cleanups = []
    this.offlineSince = null
    this.missingSince.clear()
  }

  private syncMedia() {
    const m = this.media
    if (!m) return
    const patch: Partial<RoomSessionState> = { local: m.localParticipant, remote: m.remoteParticipants }
    if (m.state === 'reconnecting' && this.state.phase === 'in-room') patch.phase = 'reconnecting'
    if (m.state === 'connected' && this.state.phase === 'reconnecting' && this.offlineSince === null) patch.phase = 'in-room'
    // A camera or mic can stop on its own (unplugged, revoked); reflect it.
    if (this.state.camera === 'on' && m.localParticipant && !m.localParticipant.cameraOn) patch.camera = 'off'
    if (this.state.mic === 'on' && m.localParticipant && !m.localParticipant.micOn) patch.mic = 'off'
    this.set(patch)
  }

  private watch(space: VirtualSpace) {
    this.cleanups.push(
      this.deps.watchSpace(space.id, (next) => {
        if (!next) return this.fail(new SpaceError('missing', SPACE_MESSAGES.missing))
        if (!next.isActive) return this.fail(new SpaceError('closed', SPACE_MESSAGES.closed))
        const patch: Partial<RoomSessionState> = { space: next }
        if (!next.allowCamera && this.state.camera !== 'blocked') {
          this.media?.disableCamera()
          patch.camera = 'blocked'
        } else if (next.allowCamera && this.state.camera === 'blocked') patch.camera = 'off'
        if (!next.allowMicrophone && this.state.mic !== 'blocked') {
          this.media?.muteMicrophone()
          patch.mic = 'blocked'
        } else if (next.allowMicrophone && this.state.mic === 'blocked') patch.mic = 'off'
        this.set(patch)
      }),
    )
    this.cleanups.push(this.deps.backend.onRosterChange(space.id, () => this.refreshRoster()))
    const poll = setInterval(() => this.refreshRoster(), ROSTER_POLL_MS)
    this.cleanups.push(() => clearInterval(poll))
  }

  /** `place`: after entering, stand somewhere free near the others if you have no spot yet. */
  private refreshRoster(place = false) {
    const space = this.state.space
    if (!space) return
    this.deps.backend
      .roster(space.id)
      .then((roster) => {
        if (this.state.space?.id !== space.id || !this.active) return
        // Keep your own spot while a move is on its way to the backend.
        const mine = this.state.roster.find((p) => p.userId === this.state.me)
        const next = roster.map((p) => (p.userId === this.state.me && mine?.x != null && p.x == null ? { ...p, x: mine.x, y: mine.y } : p))
        this.set({ roster: next })
        this.updatePeers()
        const me = next.find((p) => p.userId === this.state.me)
        if (place && me && me.x == null) {
          void this.move(this.lastSpot ?? startingSpot(next.filter((p) => p.userId !== this.state.me && p.x != null).map((p) => ({ x: p.x!, y: p.y! }))))
        }
      })
      .catch(() => {})
  }

  /** Connect to whoever is within talking distance; let go of whoever walked away. */
  private updatePeers() {
    const me = this.state.roster.find((p) => p.userId === this.state.me)
    const ids = nearby(
      me && me.x != null && me.y != null ? { x: me.x, y: me.y } : null,
      this.state.roster.filter((p) => p.userId !== this.state.me).map((p) => ({ id: p.userId, x: p.x, y: p.y })),
      new Set(this.state.nearby),
    )
    // Someone you're talking with can drop out of one roster read (a late heartbeat from a background
    // tab, a slow request). Keep the call for a little while instead of hanging up and redialling.
    const now = Date.now()
    // If it's your own row that's missing, everyone counts as missing for the moment.
    const present = new Set(me && me.x != null ? this.state.roster.map((p) => p.userId) : [])
    for (const id of this.state.nearby) {
      if (present.has(id) || ids.includes(id)) {
        this.missingSince.delete(id)
        continue
      }
      const since = this.missingSince.get(id) ?? now
      this.missingSince.set(id, since)
      if (now - since < MISSING_GRACE_MS) ids.push(id)
    }
    for (const id of [...this.missingSince.keys()]) if (present.has(id) || !ids.includes(id)) this.missingSince.delete(id)
    if (ids.join() !== this.state.nearby.join()) this.set({ nearby: ids })
    this.media?.setPeers?.(ids)
  }

  private signalsFor(spaceId: string) {
    const backend = this.deps.backend
    return {
      send: (to: string, kind: Parameters<typeof backend.signal>[2], payload: unknown) => backend.signal(spaceId, to, kind, payload),
      subscribe: (cb: Parameters<typeof backend.onSignal>[1]) => backend.onSignal(spaceId, cb),
    }
  }

  private startChat(spaceId: string) {
    this.cleanups.push(this.deps.backend.onMessage(spaceId, (m) => this.addMessage(m)))
    this.deps.backend
      .messages(spaceId)
      .then((list) => {
        if (this.state.space?.id !== spaceId) return
        const known = new Set(this.state.messages.map((m) => m.id))
        this.set({ messages: [...list.filter((m) => !known.has(m.id)).map((m) => ({ ...m, receivedAt: 0 })), ...this.state.messages].slice(-100) })
      })
      .catch(() => {})
  }

  private startMusic(spaceId: string) {
    this.cleanups.push(this.deps.backend.onMusic(spaceId, () => this.refreshMusic(spaceId)))
    this.refreshMusic(spaceId)
  }

  private refreshMusic(spaceId: string) {
    this.deps.backend
      .music(spaceId)
      .then((music) => this.state.space?.id === spaceId && this.set({ music }))
      .catch(() => {})
  }

  private addMessage(m: RoomMessage) {
    if (this.state.messages.some((x) => x.id === m.id)) return
    this.set({ messages: [...this.state.messages, { ...m, receivedAt: Date.now() }].slice(-100) })
  }

  private startHeartbeat(spaceId: string) {
    const beat = setInterval(() => this.heartbeat(spaceId), HEARTBEAT_MS)
    const offline = () => {
      this.offlineSince ??= Date.now()
      if (this.state.phase === 'in-room') this.set({ phase: 'reconnecting' })
    }
    const online = () => this.heartbeat(spaceId)
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', offline)
      window.addEventListener('online', online)
    }
    this.cleanups.push(() => {
      clearInterval(beat)
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', offline)
        window.removeEventListener('online', online)
      }
    })
  }

  /** Report camera/mic changes promptly instead of waiting for the next heartbeat. */
  private pushState() {
    const space = this.state.space
    if (space && this.state.phase === 'in-room') this.heartbeat(space.id)
  }

  private heartbeat(spaceId: string): Promise<void> {
    if (this.touching) {
      // State changed mid-flight: send it again as soon as this one lands.
      this.touchAgain = true
      return this.touching
    }
    const attempt = this.attempt
    this.touching = this.deps.backend
      .touch(spaceId, { cameraOn: this.state.camera === 'on', micOn: this.state.mic === 'on' })
      .then(async (stillHere) => {
        if (attempt !== this.attempt) return
        this.offlineSince = null
        if (stillHere) {
          if (this.state.phase === 'reconnecting') this.set({ phase: 'in-room' })
          this.refreshRoster()
          return
        }
        // Lost our place (timed out while away, or the room closed): try to take it back.
        const space = this.state.space
        if (!space) return
        try {
          await this.deps.backend.join(space.id, this.profile)
          if (attempt === this.attempt) {
            this.set({ phase: 'in-room' })
            this.refreshRoster(true)
            this.touchAgain = true // a fresh place starts with camera/mic off: report them right away
          }
        } catch (e) {
          if (attempt === this.attempt) this.fail(e)
        }
      })
      .catch(() => {
        if (attempt !== this.attempt) return
        this.offlineSince ??= Date.now()
        if (Date.now() - this.offlineSince > GIVE_UP_AFTER_MS) return this.fail(new SpaceError('network', 'Connection lost.'))
        if (this.state.phase === 'in-room') this.set({ phase: 'reconnecting' })
      })
      .finally(() => {
        this.touching = null
        if (this.touchAgain && attempt === this.attempt) {
          this.touchAgain = false
          void this.heartbeat(spaceId)
        }
      })
    return this.touching
  }
}
