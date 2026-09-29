import type { NewSpace, RoomMessage, RoomSignal, SpacePatch, SpacePresence, VirtualSpace } from './types'

/**
 * Everything Virtual Spaces needs from a backend. The UI and room session only talk to this,
 * so the cloud implementation (Supabase) and the on-device preview are interchangeable.
 */
export interface SpacesBackend {
  readonly mode: 'cloud' | 'preview'

  /* Rooms */
  listSpaces(): Promise<VirtualSpace[]>
  /** Fires when any room's configuration changes (admin edits apply live). */
  onSpacesChange(cb: () => void): () => void

  /* Presence */
  /** Current head-count per room id. */
  occupancy(): Promise<Record<string, number>>
  onOccupancyChange(cb: () => void): () => void
  roster(spaceId: string): Promise<SpacePresence[]>
  onRosterChange(spaceId: string, cb: () => void): () => void
  /** Takes a place in the room, atomically capacity-checked. Throws SpaceError. */
  join(spaceId: string, me: { name: string; avatar?: string }): Promise<void>
  /** Heartbeat. False when the place has been lost (timed out, room closed). Throws SpaceError('network'). */
  touch(spaceId: string, state: { cameraOn: boolean; micOn: boolean }): Promise<boolean>
  /** `keepalive` survives the page closing. */
  leave(spaceId: string, opts?: { keepalive?: boolean }): Promise<void>
  /** Whose presence this device reports (the signed-in identity), or null when not signed in. */
  identity(): string | null
  /** Move your circle (0–1 across and down the room). */
  move(spaceId: string, x: number, y: number): Promise<void>

  /* Chat — only people in the room can read or write */
  messages(spaceId: string): Promise<RoomMessage[]>
  onMessage(spaceId: string, cb: (m: RoomMessage) => void): () => void
  sendMessage(spaceId: string, body: string): Promise<RoomMessage>

  /* Introductions between browsers for person-to-person video/audio */
  signal(spaceId: string, to: string, kind: RoomSignal['kind'], payload: unknown): Promise<void>
  onSignal(spaceId: string, cb: (s: RoomSignal) => void): () => void

  /* Media */
  /** Short-lived media-provider token for someone admitted to the room; null when no provider is configured. */
  mediaToken(spaceId: string): Promise<MediaToken | null>

  /* Management — every call is authorized by the backend itself */
  /** A member with Host a Space (or PLACES Pass) opens their own room. */
  createSpace(input: NewSpace): Promise<VirtualSpace>
  /** Removes a room you host (admins: any non-official room). */
  deleteSpace(id: string): Promise<void>
  updateSpace(id: string, patch: SpacePatch): Promise<VirtualSpace>
  uploadBackground(spaceId: string, file: Blob): Promise<{ url: string; path: string }>
  removeBackgroundObject(path: string): Promise<void>
}

export interface MediaToken {
  provider: string
  token: string
  serverUrl?: string
  expiresAt: string
}

/** How long without a heartbeat before someone no longer counts (matches public.virtual_space_stale_after()). */
export const STALE_AFTER_MS = 45_000
export const HEARTBEAT_MS = 15_000
