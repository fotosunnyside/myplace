import { HEARTBEAT_MS, type SpacesBackend } from './backend'
import { DeviceMediaProvider } from './media/device'
import { MediaDeviceError, type MediaParticipant, type MediaProvider } from './media/types'
import { SPACE_MESSAGES, SpaceError, type SpaceErrorCode, type SpacePresence, type VirtualSpace } from './types'

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
}

export interface SessionDeps {
  backend: SpacesBackend
  createMedia: () => MediaProvider
  /** Live room configuration: calls back with the latest version of the room (or null if it disappeared). */
  watchSpace: (spaceId: string, cb: (space: VirtualSpace | null) => void) => () => void
}

const IDLE: RoomSessionState = { phase: 'idle', space: null, camera: 'off', mic: 'off', roster: [], local: null, remote: [], carriesRemoteMedia: false, me: null }
const GIVE_UP_AFTER_MS = 60_000
const ROSTER_POLL_MS = 10_000

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
  private wantCamera = false
  private wantMic = false
  private touching: Promise<void> | null = null
  private touchAgain = false
  private profile: { name: string; avatar?: string } = { name: 'Someone' }

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
      await media.connectToRoom({ spaceId: space.id, identity: this.state.me!, name: me.name, token })
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
    this.refreshRoster()

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
    this.set({ phase: endPhase[code] ?? 'error', message, local: null, remote: [], roster: [], camera: 'off', mic: 'off' })
  }

  private teardown() {
    this.cleanups.forEach((c) => c())
    this.cleanups = []
    this.offlineSince = null
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

  private refreshRoster() {
    const space = this.state.space
    if (!space) return
    this.deps.backend
      .roster(space.id)
      .then((roster) => this.state.space?.id === space.id && this.active && this.set({ roster }))
      .catch(() => {})
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
          if (attempt === this.attempt) this.set({ phase: 'in-room' })
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
