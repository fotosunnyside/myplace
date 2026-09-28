import { getState } from '@/lib/store/store'
import { STALE_AFTER_MS, type SpacesBackend } from './backend'
import { SPACE_MESSAGES, SpaceError, type SpacePresence, type VirtualSpace } from './types'

/**
 * On-device preview used until the PLACES backend is connected (e.g. the GitHub Pages build).
 *
 * The rooms mirror the launch rows in supabase/migrations. Presence is real but local: it covers the
 * tabs open on this device. Room settings can't be changed here — managing rooms needs the backend's
 * admin authorization, which the preview deliberately doesn't imitate.
 */

const at = '2026-09-28T12:00:00.000Z'
const base = {
  visibility: 'members',
  backgroundStyle: 'default',
  backgroundUrl: null,
  backgroundPath: null,
  focusX: 50,
  focusY: 50,
  isActive: true,
  allowCamera: true,
  allowMicrophone: true,
  isOfficial: true,
  parentSpaceId: null,
  instanceNumber: 1,
  createdBy: null,
  createdAt: at,
  updatedAt: at,
} as const

export const PREVIEW_SPACES: VirtualSpace[] = [
  {
    ...base,
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Town Hall',
    slug: 'town-hall',
    description: 'See who’s around. Drop in and say hello.',
    roomType: 'social',
    maxParticipants: 20,
    sortOrder: 10,
    settings: { speakingMode: 'open' },
  },
  {
    ...base,
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Accountability Room',
    slug: 'accountability-room',
    description: 'Bring your work. Stay focused together.',
    roomType: 'accountability',
    maxParticipants: 20,
    sortOrder: 20,
    settings: { speakingMode: 'open', welcome: 'Bring something you need to finish. Work quietly alongside other people and get it done.' },
  },
]

const KEY = 'places:spaces:presence'
type Board = Record<string, Record<string, SpacePresence>>
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(KEY) : null
const listeners = new Set<() => void>()
channel?.addEventListener('message', () => listeners.forEach((l) => l()))

function read(): Board {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Board
  } catch {
    return {}
  }
}
function write(board: Board) {
  try {
    localStorage.setItem(KEY, JSON.stringify(board))
  } catch {}
  channel?.postMessage('changed')
  listeners.forEach((l) => l())
}
const fresh = (p: SpacePresence) => Date.now() - Date.parse(p.lastSeenAt) < STALE_AFTER_MS
const onChange = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const need = (spaceId: string) => {
  const space = PREVIEW_SPACES.find((s) => s.id === spaceId)
  if (!space) throw new SpaceError('missing', SPACE_MESSAGES.missing)
  return space
}
const noAdmin = () => Promise.reject(new SpaceError('forbidden', 'Managing rooms needs the PLACES backend. See README → Virtual Spaces.'))

export const previewBackend: SpacesBackend = {
  mode: 'preview',

  listSpaces: async () => PREVIEW_SPACES,
  onSpacesChange: () => () => {},

  async occupancy() {
    const board = read()
    return Object.fromEntries(PREVIEW_SPACES.map((s) => [s.id, Object.values(board[s.id] ?? {}).filter(fresh).length]))
  },
  onOccupancyChange: onChange,

  async roster(spaceId) {
    return Object.values(read()[spaceId] ?? {})
      .filter(fresh)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
  },
  onRosterChange: (_spaceId, cb) => onChange(cb),

  async join(spaceId, me) {
    const space = need(spaceId)
    const id = previewBackend.identity()
    if (!id) throw new SpaceError('signin', SPACE_MESSAGES.signin)
    if (!space.isActive) throw new SpaceError('closed', SPACE_MESSAGES.closed)
    const board = read()
    const room = Object.fromEntries(Object.entries(board[spaceId] ?? {}).filter(([, p]) => fresh(p)))
    if (!room[id] && Object.keys(room).length >= space.maxParticipants) throw new SpaceError('full', SPACE_MESSAGES.full)
    const now = new Date().toISOString()
    room[id] = { userId: id, displayName: me.name, avatarUrl: me.avatar ?? null, cameraOn: false, micOn: false, zone: null, role: 'participant', joinedAt: room[id]?.joinedAt ?? now, lastSeenAt: now }
    write({ ...board, [spaceId]: room })
  },

  async touch(spaceId, state) {
    const space = need(spaceId)
    const id = previewBackend.identity()
    const board = read()
    const mine = id ? board[spaceId]?.[id] : undefined
    if (!id || !mine || !fresh(mine) || !space.isActive) return false
    board[spaceId][id] = { ...mine, cameraOn: state.cameraOn && space.allowCamera, micOn: state.micOn && space.allowMicrophone, lastSeenAt: new Date().toISOString() }
    write(board)
    return true
  },

  async leave(spaceId) {
    const id = previewBackend.identity()
    const board = read()
    if (!id || !board[spaceId]?.[id]) return
    delete board[spaceId][id]
    write(board)
  },

  identity: () => getState().accountId,

  mediaToken: async () => null,
  updateSpace: noAdmin,
  uploadBackground: noAdmin,
  removeBackgroundObject: noAdmin,
}
