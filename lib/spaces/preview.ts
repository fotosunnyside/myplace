import { HOSTED_SPACES } from '@/lib/config'
import { activePlan, canHostSpaces } from '@/lib/store/actions'
import { getState } from '@/lib/store/store'
import { previewGuest } from './guest'
import { STALE_AFTER_MS, type SpacesBackend } from './backend'
import { slugFor, validateNewSpace } from './rooms'
import { SPACE_MESSAGES, SpaceError, type RoomMessage, type RoomMusic, type RoomSignal, type SpacePresence, type VirtualSpace } from './types'

/**
 * On-device preview used until the PLACES backend is connected (e.g. the GitHub Pages build).
 *
 * The rooms mirror the launch rows in supabase/migrations. Presence is real but local: it covers the
 * tabs open on this device. Official room settings can't be changed here — managing them needs the backend's
 * admin authorization, which the preview deliberately doesn't imitate. Members with Host a Space (or the Pass)
 * can open their own rooms, kept on this device.
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
  allowResize: true,
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
    description: 'Come in. Meet people. Talk about what’s happening around PLACES.',
    roomType: 'social',
    maxParticipants: 20,
    sortOrder: 10,
    settings: { speakingMode: 'open' },
  },
  {
    ...base,
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Accountability Department',
    slug: 'accountability-room',
    visibility: 'public', // open to guests
    description: 'Bring something you need to finish. Camera on. Work quietly alongside other people and get it done.',
    roomType: 'accountability',
    maxParticipants: 20,
    sortOrder: 20,
    settings: { speakingMode: 'open', welcome: 'Bring something you need to finish. Work quietly alongside other people and get it done.' },
  },
]

/* Rooms members host on this device. */
const HOSTED_KEY = 'places:spaces:hosted'
function hosted(): VirtualSpace[] {
  try {
    return JSON.parse(localStorage.getItem(HOSTED_KEY) ?? '[]') as VirtualSpace[]
  } catch {
    return []
  }
}
function saveHosted(list: VirtualSpace[]) {
  try {
    localStorage.setItem(HOSTED_KEY, JSON.stringify(list))
  } catch {}
  spaceListeners.forEach((l) => l())
}
const spaceListeners = new Set<() => void>()
const allSpaces = () => [...PREVIEW_SPACES, ...hosted()]

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
  const space = allSpaces().find((s) => s.id === spaceId)
  if (!space) throw new SpaceError('missing', SPACE_MESSAGES.missing)
  return space
}
/* Chat and introductions between tabs on this device. */
const CHAT = 'places:spaces:chat'
const chatChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHAT) : null
const chatListeners = new Set<(spaceId: string, m: RoomMessage) => void>()
chatChannel?.addEventListener('message', (e: MessageEvent<{ spaceId: string; m: RoomMessage }>) => chatListeners.forEach((l) => l(e.data.spaceId, e.data.m)))
const readChat = (spaceId: string): RoomMessage[] => {
  try {
    return (JSON.parse(localStorage.getItem(CHAT) ?? '{}') as Record<string, RoomMessage[]>)[spaceId] ?? []
  } catch {
    return []
  }
}
const MUSIC = 'places:spaces:music'
const musicChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(MUSIC) : null
const musicListeners = new Set<() => void>()
musicChannel?.addEventListener('message', () => musicListeners.forEach((l) => l()))
const signalChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('places:spaces:signals') : null

const noAdmin = () => Promise.reject(new SpaceError('forbidden', 'Managing rooms needs the PLACES backend. See README → Virtual Places.'))

export const previewBackend: SpacesBackend = {
  mode: 'preview',

  listSpaces: async () => allSpaces(),
  onSpacesChange: (cb) => {
    spaceListeners.add(cb)
    return () => spaceListeners.delete(cb)
  },

  async occupancy() {
    const board = read()
    return Object.fromEntries(allSpaces().map((s) => [s.id, Object.values(board[s.id] ?? {}).filter(fresh).length]))
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
    if (!getState().accountId && space.visibility !== 'public') throw new SpaceError('signin', 'Join PLACES FOR US to enter this Virtual Place.')
    if (!space.isActive) throw new SpaceError('closed', SPACE_MESSAGES.closed)
    const board = read()
    const room = Object.fromEntries(Object.entries(board[spaceId] ?? {}).filter(([, p]) => fresh(p)))
    if (!room[id] && Object.keys(room).length >= space.maxParticipants) throw new SpaceError('full', SPACE_MESSAGES.full)
    const now = new Date().toISOString()
    room[id] = { userId: id, displayName: me.name, avatarUrl: me.avatar ?? null, cameraOn: false, micOn: false, zone: null, x: room[id]?.x ?? null, y: room[id]?.y ?? null, scale: room[id]?.scale ?? null, status: room[id]?.status ?? null, role: 'participant', joinedAt: room[id]?.joinedAt ?? now, lastSeenAt: now }
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

  identity: () => getState().accountId ?? previewGuest()?.id ?? null,

  async move(spaceId, x, y) {
    const id = previewBackend.identity()
    const board = read()
    const mine = id ? board[spaceId]?.[id] : undefined
    if (!id || !mine) return
    board[spaceId][id] = { ...mine, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
    write(board)
  },

  async setLook(spaceId, scale, status) {
    const id = previewBackend.identity()
    const board = read()
    const mine = id ? board[spaceId]?.[id] : undefined
    if (!id || !mine) return
    const space = need(spaceId)
    const note = status?.trim().slice(0, 60) || null
    board[spaceId][id] = { ...mine, scale: space.allowResize && scale != null ? Math.min(1.8, Math.max(0.6, scale)) : null, status: note }
    write(board)
  },

  async music(spaceId) {
    try {
      return (JSON.parse(localStorage.getItem(MUSIC) ?? '{}') as Record<string, RoomMusic>)[spaceId] ?? null
    } catch {
      return null
    }
  },

  onMusic: (_spaceId, cb) => {
    musicListeners.add(cb)
    return () => musicListeners.delete(cb)
  },

  async setMusic(spaceId, videoId, title = '') {
    const id = previewBackend.identity()
    const space = need(spaceId)
    if (!id || !read()[spaceId]?.[id]) throw new SpaceError('forbidden', 'Enter the room first.')
    if (!activePlan(getState(), 'pass') && space.createdBy !== id) throw new SpaceError('forbidden', 'PLACES Pass members can play music for the room.')
    try {
      const all = JSON.parse(localStorage.getItem(MUSIC) ?? '{}') as Record<string, RoomMusic>
      if (videoId) all[spaceId] = { videoId, title: title.slice(0, 120), startedBy: id, startedAt: new Date().toISOString() }
      else delete all[spaceId]
      localStorage.setItem(MUSIC, JSON.stringify(all))
    } catch {}
    musicChannel?.postMessage('changed')
    musicListeners.forEach((l) => l())
  },

  messages: async (spaceId) => readChat(spaceId),

  onMessage(spaceId, cb) {
    const l = (room: string, m: RoomMessage) => room === spaceId && cb(m)
    chatListeners.add(l)
    return () => chatListeners.delete(l)
  },

  async sendMessage(spaceId, body) {
    const id = previewBackend.identity()
    const mine = id ? read()[spaceId]?.[id] : undefined
    if (!id || !mine) throw new SpaceError('forbidden', 'Enter the room to chat.')
    const text = body.trim().slice(0, 500)
    if (!text) throw new SpaceError('unknown', 'Write a message first.')
    const m: RoomMessage = { id: crypto.randomUUID(), userId: id, name: mine.displayName, body: text, createdAt: new Date().toISOString() }
    try {
      const all = JSON.parse(localStorage.getItem(CHAT) ?? '{}') as Record<string, RoomMessage[]>
      all[spaceId] = [...(all[spaceId] ?? []), m].slice(-100)
      localStorage.setItem(CHAT, JSON.stringify(all))
    } catch {}
    chatChannel?.postMessage({ spaceId, m })
    chatListeners.forEach((l) => l(spaceId, m))
    return m
  },

  async signal(spaceId, to, kind, payload) {
    signalChannel?.postMessage({ spaceId, to, from: previewBackend.identity(), kind, payload })
  },

  onSignal(spaceId, cb) {
    const l = (e: MessageEvent<{ spaceId: string; to: string; from: string; kind: RoomSignal['kind']; payload: unknown }>) => {
      if (e.data.spaceId === spaceId && e.data.to === previewBackend.identity()) cb({ from: e.data.from, kind: e.data.kind, payload: e.data.payload })
    }
    signalChannel?.addEventListener('message', l)
    return () => signalChannel?.removeEventListener('message', l)
  },

  mediaToken: async () => null,

  async createSpace(input) {
    const me = getState().accountId
    if (!me) throw new SpaceError('signin', SPACE_MESSAGES.signin)
    if (!canHostSpaces(getState())) throw new SpaceError('forbidden', 'Create Virtual Places or PLACES Pass lets you create your own Virtual Places.')
    const mine = hosted().filter((s) => s.createdBy === me)
    if (mine.length >= HOSTED_SPACES.roomsPerHost) throw new SpaceError('forbidden', `You can create up to ${HOSTED_SPACES.roomsPerHost} Virtual Places for now.`)
    const problem = validateNewSpace(input, HOSTED_SPACES.maxParticipants)
    if (problem) throw new SpaceError('unknown', problem)
    const now = new Date().toISOString()
    const space: VirtualSpace = {
      ...base,
      id: crypto.randomUUID(),
      name: input.name.trim(),
      slug: slugFor(input.name),
      description: input.description.trim(),
      roomType: input.roomType,
      maxParticipants: input.maxParticipants,
      allowResize: input.allowResize ?? true,
      isOfficial: false,
      sortOrder: 100,
      settings: {},
      createdBy: me,
      createdAt: now,
      updatedAt: now,
    }
    saveHosted([...hosted(), space])
    return space
  },

  async deleteSpace(id) {
    const me = getState().accountId
    const list = hosted()
    if (!list.some((s) => s.id === id && s.createdBy === me)) throw new SpaceError('forbidden', 'You can only remove rooms you host.')
    saveHosted(list.filter((s) => s.id !== id))
  },

  updateSpace: noAdmin,
  uploadBackground: noAdmin,
  removeBackgroundObject: noAdmin,
}
