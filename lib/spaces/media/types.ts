import type { MediaToken } from '../backend'
import type { RoomSignal } from '../types'

/**
 * The contract between Virtual Spaces and whatever carries live video/audio.
 *
 * Room UI and the room session only use this interface — no vendor SDK calls anywhere else —
 * so a WebRTC provider can be connected (or swapped) by adding one adapter in ./providers.
 * Media never flows through Supabase.
 */

export type MediaConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface MediaParticipant {
  /** PLACES user id (the same identity used for presence). */
  identity: string
  name: string
  isLocal: boolean
  cameraOn: boolean
  micOn: boolean
  speaking: boolean
  videoStream: MediaStream | null
  /** Remote audio to play. Never set for the local participant (no echo). */
  audioStream: MediaStream | null
}

export interface ConnectOptions {
  spaceId: string
  identity: string
  name: string
  /** From the virtual-space-token Edge Function; null when the provider doesn't need one. */
  token: MediaToken | null
  /** Messages to and from other people's browsers in the room (for person-to-person providers). */
  signals?: SignalChannel
}

export interface SignalChannel {
  send(to: string, kind: RoomSignal['kind'], payload: unknown): Promise<void>
  subscribe(cb: (s: RoomSignal) => void): () => void
}

export type DeviceErrorKind = 'denied' | 'not-found' | 'in-use' | 'insecure' | 'unknown'

/** Thrown by enableCamera/unmuteMicrophone when a device can't be used. */
export class MediaDeviceError extends Error {
  constructor(
    public device: 'camera' | 'microphone',
    public kind: DeviceErrorKind,
  ) {
    super(`${device}: ${kind}`)
  }
}

export interface MediaProvider {
  /** Shown in diagnostics only. */
  readonly name: string
  /** True when other people's video/audio reach this device (false for the on-device preview). */
  readonly carriesRemoteMedia: boolean
  /** True when connectToRoom needs a token from the virtual-space-token Edge Function. */
  readonly needsToken: boolean

  readonly state: MediaConnectionState
  readonly localParticipant: MediaParticipant | null
  readonly remoteParticipants: MediaParticipant[]

  connectToRoom(options: ConnectOptions): Promise<void>
  disconnectFromRoom(): Promise<void>
  enableCamera(): Promise<void>
  disableCamera(): Promise<void>
  unmuteMicrophone(): Promise<void>
  muteMicrophone(): Promise<void>

  /** Called whenever state, participants or tracks change. */
  subscribe(listener: () => void): () => void

  /** Person-to-person providers: the people you're close enough to see and hear. */
  setPeers?(ids: string[]): void
}

/** Normalizes getUserMedia failures across browsers. */
export function deviceErrorKind(e: unknown): DeviceErrorKind {
  const name = (e as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'not-found'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'in-use'
  if (name === 'TypeError' || name === 'InsecureContext') return 'insecure'
  return 'unknown'
}
