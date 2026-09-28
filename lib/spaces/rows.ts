import { ROOM_TYPES, type RoomType, type SpacePatch, type SpacePresence, type SpaceSettings, type VirtualSpace } from './types'

/** Database row shapes (public.virtual_spaces / public.virtual_space_participants). */
export interface SpaceRow {
  id: string
  name: string
  slug: string
  description: string
  room_type: string
  visibility: VirtualSpace['visibility']
  background_style: VirtualSpace['backgroundStyle']
  background_url: string | null
  background_path: string | null
  background_focus_x: number
  background_focus_y: number
  max_participants: number
  is_active: boolean
  allow_camera: boolean
  allow_microphone: boolean
  is_official: boolean
  sort_order: number
  parent_space_id: string | null
  instance_number: number
  settings: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PresenceRow {
  space_id: string
  user_id: string
  display_name: string
  avatar_url: string | null
  camera_on: boolean
  mic_on: boolean
  zone: string | null
  role: SpacePresence['role']
  joined_at: string
  last_seen_at: string
}

const roomType = (v: string): RoomType => ((ROOM_TYPES as readonly string[]).includes(v) ? (v as RoomType) : 'social')

function settingsFrom(raw: Record<string, unknown> | null): SpaceSettings {
  const s = raw ?? {}
  return {
    speakingMode: s.speaking_mode === 'moderated' ? 'moderated' : 'open',
    welcome: typeof s.welcome === 'string' ? s.welcome : undefined,
    startMuted: typeof s.start_muted === 'boolean' ? s.start_muted : undefined,
  }
}

export function spaceFromRow(r: SpaceRow): VirtualSpace {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? '',
    roomType: roomType(r.room_type),
    visibility: r.visibility,
    backgroundStyle: r.background_style,
    backgroundUrl: r.background_url,
    backgroundPath: r.background_path,
    focusX: r.background_focus_x ?? 50,
    focusY: r.background_focus_y ?? 50,
    maxParticipants: r.max_participants,
    isActive: r.is_active,
    allowCamera: r.allow_camera,
    allowMicrophone: r.allow_microphone,
    isOfficial: r.is_official,
    sortOrder: r.sort_order,
    parentSpaceId: r.parent_space_id,
    instanceNumber: r.instance_number,
    settings: settingsFrom(r.settings),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const COLUMNS: Record<keyof SpacePatch, keyof SpaceRow> = {
  name: 'name',
  description: 'description',
  maxParticipants: 'max_participants',
  isActive: 'is_active',
  allowCamera: 'allow_camera',
  allowMicrophone: 'allow_microphone',
  backgroundStyle: 'background_style',
  backgroundUrl: 'background_url',
  backgroundPath: 'background_path',
  focusX: 'background_focus_x',
  focusY: 'background_focus_y',
}

/** Only whitelisted, admin-editable columns ever leave the client. */
export function patchToRow(patch: SpacePatch): Partial<SpaceRow> {
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    const column = COLUMNS[key as keyof SpacePatch]
    if (column && value !== undefined) row[column] = value
  }
  return row as Partial<SpaceRow>
}

export const presenceFromRow = (r: PresenceRow): SpacePresence => ({
  userId: r.user_id,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  cameraOn: r.camera_on,
  micOn: r.mic_on,
  zone: r.zone,
  role: r.role,
  joinedAt: r.joined_at,
  lastSeenAt: r.last_seen_at,
})

/** Maps database errors raised by join_virtual_space (PLC0x) to room states. */
export function spaceErrorCode(err: { code?: string; message?: string } | null | undefined) {
  switch (err?.code) {
    case 'PLC01':
      return 'signin' as const
    case 'PLC02':
      return 'missing' as const
    case 'PLC03':
      return 'closed' as const
    case 'PLC04':
      return 'full' as const
    case '42501':
      return 'forbidden' as const
  }
  if (/row-level security|unauthori[sz]ed|permission denied/i.test(err?.message ?? '')) return 'forbidden' as const
  if (/fetch|network|failed to fetch|load failed/i.test(err?.message ?? '')) return 'network' as const
  return 'unknown' as const
}
