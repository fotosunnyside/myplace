import type { NewSpace, RoomType, SpacePatch, VirtualSpace } from './types'

/**
 * Room presentation and behaviour, derived from each room's configuration — never from its slug,
 * so renamed rooms, overflow rooms and member-created rooms all behave the same way.
 */

/** The PLACES art used when a room's background is set to "default", by room type. */
const DEFAULT_ART: Partial<Record<RoomType, string>> = {
  social: '/districts/yourplace-banner.webp',
  community: '/districts/yourplace-banner.webp',
  networking: '/districts/workplace-banner.webp',
  meeting: '/districts/workplace-banner.webp',
  coworking: '/districts/workplace-banner.webp',
  event: '/districts/marketplace-banner.webp',
}
const FALLBACK_ART = '/districts/mindplace-banner.webp' // learning, focus, study, classes

export const defaultArtFor = (type: RoomType) => DEFAULT_ART[type] ?? FALLBACK_ART

/** PLACES scenes a host can pick for their room without uploading anything. */
export const ROOM_SCENES: { id: string; name: string; src: string }[] = [
  { id: 'yourplace', name: 'Sunset terrace', src: '/districts/yourplace-banner.webp' },
  { id: 'mindplace', name: 'Garden library', src: '/districts/mindplace-banner.webp' },
  { id: 'marketplace', name: 'Seaside market', src: '/districts/marketplace-banner.webp' },
  { id: 'workplace', name: 'Harbor café', src: '/districts/workplace-banner.webp' },
]

export type RoomBackground =
  | { kind: 'image'; src: string; focusX: number; focusY: number; isDefault: boolean }
  | { kind: 'none' }

export function roomBackground(space: Pick<VirtualSpace, 'backgroundStyle' | 'backgroundUrl' | 'roomType' | 'focusX' | 'focusY'>): RoomBackground {
  if (space.backgroundStyle === 'none') return { kind: 'none' }
  if (space.backgroundStyle === 'custom' && space.backgroundUrl) return { kind: 'image', src: space.backgroundUrl, focusX: space.focusX, focusY: space.focusY, isDefault: false }
  return { kind: 'image', src: defaultArtFor(space.roomType), focusX: space.focusX, focusY: space.focusY, isDefault: true }
}

/** Arrive quietly in focus rooms unless the room says otherwise. */
const QUIET_TYPES: RoomType[] = ['accountability', 'study', 'coworking', 'class']

export interface RoomBehaviour {
  quiet: boolean
  startWithCamera: boolean
  startWithMic: boolean
  cta: string
  arrivingLabel: string
}

export function roomBehaviour(space: Pick<VirtualSpace, 'name' | 'roomType' | 'settings' | 'allowCamera' | 'allowMicrophone'>): RoomBehaviour {
  const quiet = QUIET_TYPES.includes(space.roomType)
  const startMuted = space.settings.startMuted ?? quiet
  return {
    quiet,
    startWithCamera: space.allowCamera,
    startWithMic: space.allowMicrophone && !startMuted,
    cta: quiet ? 'Start Working' : `Enter ${space.name}`,
    arrivingLabel: quiet ? 'Finding you a desk…' : `Stepping into ${space.name}…`,
  }
}

export const peopleHere = (n: number) => (n === 0 ? 'No one here yet' : `${n} ${n === 1 ? 'person' : 'people'} here`)

/** Official rooms first, in their configured order. Overflow rooms follow their first room. */
export function sortSpaces(spaces: VirtualSpace[]) {
  return [...spaces].sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial) || a.sortOrder - b.sortOrder || a.instanceNumber - b.instanceNumber || a.name.localeCompare(b.name))
}

/** Rooms given a place on YourPlace: top-level official rooms (overflow rooms are reached from their first room). */
export const featuredSpaces = (spaces: VirtualSpace[]) => sortSpaces(spaces).filter((s) => s.isOfficial && !s.parentSpaceId)

/** Rooms a member hosts. */
export const hostedBy = (spaces: VirtualSpace[], userId: string | null) => (userId ? sortSpaces(spaces).filter((s) => !s.isOfficial && s.createdBy === userId) : [])

/** A readable, unique address for a new room. */
export function slugFor(name: string) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'room'
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

/** Virtual Places live in YourPlace: the list is a YourPlace tab, each room has its own page. */
export const PLACES_HREF = '/yourplace/?tab=places'
export const CREATE_PLACE_HREF = '/yourplace/?tab=places&host=1'
export const ROOM_PATH = '/yourplace/place'
export const roomHref = (slug: string, enter = false) => `${ROOM_PATH}/?room=${encodeURIComponent(slug)}${enter ? '&enter=1' : ''}`

/* ------------------------------------------------------------------ */
/* Validation (mirrors the database's check constraints)                */
/* ------------------------------------------------------------------ */

export const CAPACITY_MIN = 2
export const CAPACITY_MAX = 500
export const NAME_MAX = 80
export const DESCRIPTION_MAX = 280

/** Checks a host's new room (mirrors the database's checks and public.hosted_space_limits()). */
export function validateNewSpace(input: NewSpace, maxParticipants: number): string | null {
  const name = input.name.trim()
  if (!name) return 'Give your room a name.'
  if (name.length > NAME_MAX) return `Keep the name under ${NAME_MAX} characters.`
  if (input.description.length > DESCRIPTION_MAX) return `Keep the description under ${DESCRIPTION_MAX} characters.`
  if (!Number.isInteger(input.maxParticipants) || input.maxParticipants < CAPACITY_MIN || input.maxParticipants > maxParticipants)
    return `Hosted rooms hold ${CAPACITY_MIN} to ${maxParticipants} people for now.`
  return null
}

export function validatePatch(patch: SpacePatch): Partial<Record<keyof SpacePatch, string>> {
  const errors: Partial<Record<keyof SpacePatch, string>> = {}
  if (patch.name !== undefined) {
    const n = patch.name.trim()
    if (!n) errors.name = 'Give the room a name.'
    else if (n.length > NAME_MAX) errors.name = `Keep the name under ${NAME_MAX} characters.`
  }
  if (patch.description !== undefined && patch.description.length > DESCRIPTION_MAX) errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`
  if (patch.maxParticipants !== undefined) {
    const c = patch.maxParticipants
    if (!Number.isInteger(c)) errors.maxParticipants = 'Capacity must be a whole number.'
    else if (c < CAPACITY_MIN || c > CAPACITY_MAX) errors.maxParticipants = `Choose between ${CAPACITY_MIN} and ${CAPACITY_MAX} people.`
  }
  for (const k of ['focusX', 'focusY'] as const) {
    const v = patch[k]
    if (v !== undefined && (!Number.isInteger(v) || v < 0 || v > 100)) errors[k] = 'Focus is a percentage from 0 to 100.'
  }
  if (patch.backgroundStyle === 'custom' && patch.backgroundUrl === null) errors.backgroundUrl = 'Upload an image or choose the default background.'
  return errors
}

export const BACKGROUND_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const BACKGROUND_MAX_BYTES = 5 * 1024 * 1024

/** Checks an admin's chosen background file before it's processed and uploaded. */
export function checkBackgroundFile(file: { type: string; size: number }): string | null {
  if (!(BACKGROUND_TYPES as readonly string[]).includes(file.type)) return 'Choose a JPEG, PNG or WebP image.'
  if (file.size > 20 * 1024 * 1024) return 'That image is larger than 20 MB. Choose a smaller one.'
  return null
}
