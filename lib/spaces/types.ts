/**
 * Virtual Spaces — live places people enter together.
 *
 * One model for every room. Town Hall and the Accountability Department are simply the first two
 * official rows; course rooms, masterminds, study rooms and member-created rooms reuse it.
 */

export const ROOM_TYPES = [
  'social',
  'accountability',
  'course',
  'membership',
  'community',
  'networking',
  'mastermind',
  'study',
  'coworking',
  'meeting',
  'event',
  'class',
] as const
export type RoomType = (typeof ROOM_TYPES)[number]

export type SpaceVisibility = 'public' | 'members' | 'private'
export type BackgroundStyle = 'default' | 'custom' | 'none'

/** Room-type behaviour that doesn't need its own column yet. */
export interface SpaceSettings {
  /** 'moderated' is reserved for rooms where a moderator hands out the floor. */
  speakingMode?: 'open' | 'moderated'
  /** Shown quietly to people as they arrive. */
  welcome?: string
  /** Arrive with the microphone off (quiet rooms). Defaults by room type. */
  startMuted?: boolean
}

export interface VirtualSpace {
  id: string
  name: string
  slug: string
  description: string
  roomType: RoomType
  visibility: SpaceVisibility
  backgroundStyle: BackgroundStyle
  backgroundUrl: string | null
  backgroundPath: string | null
  /** Focal point (0–100 %) kept in view when the background is cropped. */
  focusX: number
  focusY: number
  maxParticipants: number
  isActive: boolean
  allowCamera: boolean
  allowMicrophone: boolean
  /** The room's creator lets people make their bubble bigger or smaller. */
  allowResize: boolean
  isOfficial: boolean
  sortOrder: number
  /** Overflow rooms ("Town Hall 2") point at their first room. */
  parentSpaceId: string | null
  instanceNumber: number
  settings: SpaceSettings
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** What an admin (later: a room owner) can change. */
export type SpacePatch = Partial<
  Pick<
    VirtualSpace,
    | 'name'
    | 'description'
    | 'maxParticipants'
    | 'isActive'
    | 'visibility'
    | 'allowCamera'
    | 'allowMicrophone'
    | 'allowResize'
    | 'backgroundStyle'
    | 'backgroundUrl'
    | 'backgroundPath'
    | 'focusX'
    | 'focusY'
  >
>

/** What a host chooses when opening their own room. */
export interface NewSpace {
  name: string
  description: string
  roomType: RoomType
  maxParticipants: number
  /** Let people resize their bubbles (default yes). */
  allowResize?: boolean
}

/** Room types members can host today. */
export const HOSTED_ROOM_TYPES: { type: RoomType; label: string }[] = [
  { type: 'meeting', label: 'Meeting' },
  { type: 'community', label: 'Community room' },
  { type: 'class', label: 'Class' },
  { type: 'study', label: 'Study group' },
  { type: 'networking', label: 'Networking' },
  { type: 'accountability', label: 'Accountability room' },
  { type: 'mastermind', label: 'Mastermind' },
  { type: 'event', label: 'Event' },
]

/** Someone currently in a room. */
export interface SpacePresence {
  userId: string
  displayName: string
  avatarUrl: string | null
  cameraOn: boolean
  micOn: boolean
  /** Reserved for conversation circles inside a room. */
  zone: string | null
  /** Where their circle stands, 0–1 across and down the room; null until they've been placed. */
  x: number | null
  y: number | null
  /** Their bubble's size (1 = normal), when the room allows resizing. */
  scale: number | null
  /** A short note shown on their bubble ("Heads down until 3"). */
  status: string | null
  role: 'participant' | 'speaker' | 'moderator'
  joinedAt: string
  lastSeenAt: string
}

/** Something said in a room's chat. */
export interface RoomMessage {
  id: string
  userId: string
  name: string
  body: string
  createdAt: string
  /** When it reached this device (ms); 0 for chat history from before you arrived. */
  receivedAt?: number
}

/** A connection message between two browsers in the same room (person-to-person video/audio). */
export interface RoomSignal {
  from: string
  kind: 'offer' | 'answer' | 'ice' | 'bye'
  payload: unknown
}

/** A song in the PLACES music library that rooms can play. */
export interface RoomTrack {
  id: string
  title: string
  artist: string
  /** Where it comes from and the terms PLACES plays it under. */
  license: string
  url: string
  path: string
  /** Seconds; null until known. */
  durationS: number | null
  isActive: boolean
  sortOrder: number
}

/** Music playing in a room (a library track), started by a PLACES Pass member or the room's host. */
export interface RoomMusic {
  trackId: string
  title: string
  artist: string
  url: string
  durationS: number | null
  startedBy: string | null
  startedAt: string
}

export type SpaceErrorCode ='signin' | 'missing' | 'closed' | 'full' | 'network' | 'forbidden' | 'unknown'

export class SpaceError extends Error {
  constructor(
    public code: SpaceErrorCode,
    message: string,
  ) {
    super(message)
  }
}

export const SPACE_MESSAGES: Record<SpaceErrorCode, string> = {
  signin: 'Sign in to enter this room.',
  missing: 'We couldn’t find that room.',
  closed: 'This room is currently closed.',
  full: 'This room is currently full.',
  network: 'We couldn’t reach PLACES. Check your connection and try again.',
  forbidden: 'You don’t have permission to do that.',
  unknown: 'Something went wrong. Please try again.',
}
