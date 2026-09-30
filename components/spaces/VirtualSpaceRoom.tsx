'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Compass, Info, Loader2, Timer, Users, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DistrictIcon } from '@/components/districts/DistrictIcon'
import { Button } from '@/components/ui/primitives'
import { useAdminStatus, useBackendSession } from '@/lib/backend/auth'
import { backendConfigured } from '@/lib/backend/client'
import { layoutBubbles } from '@/lib/spaces/layout'
import { clampSpot, ROOM_ASPECT, step, TALK_DISTANCE, type Spot } from '@/lib/spaces/proximity'
import { devicePrefs, roomSession, saveDevicePrefs, useRoomSession } from '@/lib/spaces/live'
import { peopleHere, roomBehaviour, roomHref, PLACES_HREF } from '@/lib/spaces/rooms'
import type { RoomSessionState } from '@/lib/spaces/session'
import { useOccupancy, useSpaces } from '@/lib/spaces/store'
import type { VirtualSpace } from '@/lib/spaces/types'
import { useHydrated, useMe } from '@/lib/store/hooks'
import { orderedDistricts } from '@/lib/world/districts'
import { openAuth } from '@/lib/ui'
import { dropInAsGuest, openToGuests, useGuest } from '@/lib/spaces/guest'
import { cn } from '@/lib/cn'
import { ParticipantBubble, type BubblePerson } from './ParticipantBubble'
import { PersonCard } from './PersonCard'
import { MyBubbleCard } from './MyBubbleCard'
import { MusicPanel, MusicPlayer } from './RoomMusic'
import { RoomBackgroundPanel } from './RoomBackgroundPanel'
import { activePlan } from '@/lib/store/actions'
import { useWorld } from '@/lib/store/hooks'
import { BubbleComposer, ChatPanel, SpeechBubble, saveChatMode, savedChatMode, useFreshMessages, type ChatMode } from './RoomChat'
import { deviceHint, RoomControls } from './RoomControls'
import { RoomBackdrop } from './RoomBackdrop'
import { RoomStatus } from './SpaceCard'

/** /yourplace/place/?room=<slug> — resolves the room from live configuration, then hands it to the shared room engine. */
export function VirtualSpacePage() {
  const params = useSearchParams()
  const slug = params.get('room') ?? ''
  const spaces = useSpaces()
  const list = 'data' in spaces && spaces.data ? spaces.data : []
  const space = list.find((s) => s.slug === slug)

  if (!space) {
    const loading = spaces.status === 'loading'
    return (
      <RoomFrame>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#cfeef7_0%,#e9f6f3_55%,#fff9ef_100%)]" />
        <StateCard
          title={loading ? 'Finding the room…' : spaces.status === 'error' ? 'We couldn’t reach PLACES FOR US' : 'We couldn’t find that room'}
          body={loading ? undefined : spaces.status === 'error' ? 'Check your connection and try again.' : 'It may have moved or been renamed.'}
          busy={loading}
          actions={!loading && <BackToMyPlace />}
        />
      </RoomFrame>
    )
  }
  return <VirtualSpaceRoom space={space} autoEnter={params.get('enter') === '1'} />
}

/** Full-screen stage above the site chrome: while you're here, the room is the page. */
function RoomFrame({ children, label }: { children: ReactNode; label?: string }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="fixed inset-0 z-[45] overflow-hidden bg-navy text-white" aria-label={label}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The shared room engine                                               */
/* ------------------------------------------------------------------ */

export function VirtualSpaceRoom({ space, autoEnter }: { space: VirtualSpace; autoEnter: boolean }) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const ready = useHydrated()
  const account = useMe()
  const cloud = useBackendSession()
  const session = useRoomSession()
  const occupancy = useOccupancy()
  const behaviour = roomBehaviour(space)
  const mine = session.space?.id === space.id
  const phase = mine ? session.phase : 'idle'
  // The live version of the room while inside (admin edits apply immediately).
  const room = mine && session.space ? session.space : space
  const [prefs, setPrefs] = useState<{ camera: boolean; mic: boolean } | null>(null)

  const guest = useGuest()
  const guestOk = openToGuests(space)
  const asGuest = !account && !!guest && guestOk
  const profile = account ? { name: account.name, avatar: account.avatar } : asGuest ? { name: guest!.name } : null
  const cloudPending = backendConfigured && cloud.status === 'loading'
  const signedIn = (!!account && (!backendConfigured || (cloud.status === 'signed-in' && !cloud.guest))) || asGuest

  useEffect(() => {
    if (!ready) return
    const saved = devicePrefs()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this device after hydration
    setPrefs({ camera: saved.camera ?? behaviour.startWithCamera, mic: behaviour.quiet ? false : (saved.mic ?? behaviour.startWithMic) })
  }, [ready, behaviour.startWithCamera, behaviour.startWithMic, behaviour.quiet])

  const enter = (p = prefs) => {
    if (!profile || !p) return
    saveDevicePrefs(p)
    void roomSession.enter(space, profile, { camera: p.camera && space.allowCamera, mic: p.mic && space.allowMicrophone })
  }

  // Arriving from a room card: step straight in.
  const autoEntered = useRef(false)
  useEffect(() => {
    if (!autoEnter || autoEntered.current || !prefs || cloudPending || !signedIn || !space.isActive) return
    if (mine && phase !== 'idle') return
    autoEntered.current = true
    enter(prefs)
    router.replace(roomHref(space.slug))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnter, prefs, cloudPending, signedIn, space.isActive])

  const leave = async () => {
    await roomSession.leave()
    router.push(PLACES_HREF)
  }

  const count = mine && (phase === 'in-room' || phase === 'reconnecting') ? session.roster.length || 1 : occupancy?.[space.id]

  return (
    <RoomFrame label={room.name}>
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { opacity: 0, scale: 1.06, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      >
        <RoomBackdrop space={room} priority />
      </motion.div>

      <TopBar space={room} count={count ?? null} phase={phase} quiet={behaviour.quiet} joinedAt={session.local ? session.roster.find((r) => r.userId === session.me)?.joinedAt : undefined} />

      {phase === 'in-room' || phase === 'reconnecting' ? (
        <InRoom session={session} space={room} quiet={behaviour.quiet} onLeave={leave} />
      ) : (
        <Threshold
          space={room}
          phase={phase}
          session={session}
          prefs={prefs}
          setPrefs={setPrefs}
          count={count ?? null}
          signedIn={signedIn}
          waiting={!ready || cloudPending || (autoEnter && signedIn && space.isActive)}
          hasAccount={!!account}
          guestOk={guestOk && !account}
          onEnter={() => enter()}
          onRetry={() => void roomSession.retry()}
        />
      )}
    </RoomFrame>
  )
}

/* ------------------------------------------------------------------ */

function TopBar({ space, count, phase, quiet, joinedAt }: { space: VirtualSpace; count: number | null; phase: RoomSessionState['phase']; quiet: boolean; joinedAt?: string }) {
  const [placesOpen, setPlacesOpen] = useState(false)
  const inside = phase === 'in-room' || phase === 'reconnecting'
  return (
    <header className="pt-safe absolute inset-x-0 top-0 z-20">
      <div className="flex items-start justify-between gap-3 px-3 pt-3 md:px-6 md:pt-5">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <Link
            href={PLACES_HREF}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/85 text-navy shadow-soft backdrop-blur-md transition hover:bg-white md:h-11 md:w-auto md:gap-1 md:px-4 md:pr-5 md:text-sm md:font-medium"
            aria-label={inside ? 'Virtual Places (you’ll stay in the room)' : 'Back to Virtual Places'}
          >
            <span className="flex items-center gap-1">
              <ChevronLeft className="h-5 w-5" />
              <span className="hidden md:inline">Virtual Places</span>
            </span>
          </Link>
          <div className="min-w-0 rounded-full bg-navy/35 py-1.5 pl-4 pr-3 shadow-soft ring-1 ring-white/15 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-[1.15rem] leading-tight md:text-[1.45rem]">{space.name}</h1>
              <RoomStatus live={space.isActive} className="!px-2 !py-0.5 !text-[0.58rem]" />
            </div>
            <p className="flex items-center gap-2 text-[0.72rem] text-white/80">
              {count != null && (
                <span className="inline-flex items-center gap-1" data-testid="room-count">
                  <Users className="h-3 w-3" /> {peopleHere(count)}
                </span>
              )}
              {quiet && inside && joinedAt && <FocusTimer since={joinedAt} />}
            </p>
          </div>
        </div>

        <nav aria-label="Places" className="relative shrink-0">
          <ul className="hidden items-center gap-1 rounded-full bg-white/85 p-1 shadow-soft backdrop-blur-md lg:flex">
            {orderedDistricts().map((d) => (
              <li key={d.id}>
                <Link href={d.href} title={inside ? `Visit ${d.name} — you’ll stay in the room` : d.name} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-navy transition hover:bg-teal-wash">
                  <DistrictIcon icon={d.icon} className="h-4 w-4 text-teal-deep" /> {d.name}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPlacesOpen((v) => !v)}
            aria-expanded={placesOpen}
            aria-label="Places"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-teal-deep shadow-soft backdrop-blur-md lg:hidden"
          >
            {placesOpen ? <X className="h-5 w-5" /> : <Compass className="h-5 w-5" />}
          </button>
          <AnimatePresence>
            {placesOpen && (
              <motion.ul
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-12 w-56 rounded-2xl bg-white p-1.5 text-navy shadow-lift lg:hidden"
              >
                {orderedDistricts().map((d) => (
                  <li key={d.id}>
                    <Link href={d.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-ivory">
                      <DistrictIcon icon={d.icon} className="h-4 w-4 text-teal-deep" /> {d.name}
                    </Link>
                  </li>
                ))}
                {inside && <li className="px-3 pb-1.5 pt-1 text-[0.7rem] text-muted">You’ll stay in the room while you look around.</li>}
              </motion.ul>
            )}
          </AnimatePresence>
        </nav>
      </div>
    </header>
  )
}

function FocusTimer({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000))
  return (
    <span className="inline-flex items-center gap-1">
      <Timer className="h-3 w-3" /> {mins < 1 ? 'Just settled in' : `Focused ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`}`}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Before you're inside: the doorway, and every way entry can go       */
/* ------------------------------------------------------------------ */

function Threshold({
  space,
  phase,
  session,
  prefs,
  setPrefs,
  count,
  signedIn,
  waiting,
  hasAccount,
  guestOk,
  onEnter,
  onRetry,
}: {
  space: VirtualSpace
  phase: RoomSessionState['phase']
  session: RoomSessionState
  prefs: { camera: boolean; mic: boolean } | null
  setPrefs: (p: { camera: boolean; mic: boolean }) => void
  count: number | null
  signedIn: boolean
  waiting: boolean
  hasAccount: boolean
  guestOk: boolean
  onEnter: () => void
  onRetry: () => void
}) {
  const behaviour = roomBehaviour(space)

  if (phase === 'joining' || phase === 'connecting' || (waiting && phase === 'idle'))
    return <StateCard title={phase === 'connecting' ? 'Connecting…' : behaviour.arrivingLabel} busy />

  if (!space.isActive || phase === 'closed')
    return <StateCard title="This room is currently closed." body="Check back soon — PLACES opens its rooms regularly." actions={<BackToMyPlace />} tone="closed" />

  if (phase === 'full')
    return (
      <StateCard
        title="This room is currently full."
        body={`${space.name} holds ${space.maxParticipants} people at a time. A place usually frees up soon.`}
        actions={
          <>
            <Button onClick={onRetry}>Try again</Button>
            <BackToMyPlace />
          </>
        }
      />
    )

  if (phase === 'lost' || phase === 'error')
    return (
      <StateCard
        icon={<WifiOff className="h-6 w-6" />}
        title={phase === 'lost' ? 'Connection lost.' : 'Something went wrong.'}
        body={session.message && phase === 'error' ? session.message : 'We couldn’t keep you connected to the room.'}
        actions={
          <>
            <Button onClick={onRetry}>Reconnect</Button>
            <BackToMyPlace />
          </>
        }
      />
    )

  if (phase === 'missing') return <StateCard title="We couldn’t find that room" body="It may have moved or been renamed." actions={<BackToMyPlace />} />

  if ((!signedIn || phase === 'signin') && guestOk) return <GuestDoor space={space} onEnter={onEnter} />

  if (!signedIn || phase === 'signin')
    return (
      <StateCard
        title={`Enter ${space.name}`}
        body={hasAccount ? 'Sign in with your PLACES FOR US password to enter this Virtual Place.' : 'Virtual Places are free for everyone with a PLACES FOR US account.'}
        actions={
          <>
            <Button onClick={() => openAuth({ mode: hasAccount ? 'signin' : 'join', reason: `Rooms are free for PLACES members.`, onDone: () => setTimeout(onEnter, 300) })}>
              {hasAccount ? 'Sign in to enter' : 'Join PLACES FOR US'}
            </Button>
            <BackToMyPlace />
          </>
        }
      />
    )

  // The doorway: choose camera/mic, then step inside.
  return (
    <div className="absolute inset-0 z-10 grid place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-panel bg-white/90 p-6 text-center text-navy shadow-lift backdrop-blur-xl md:p-8"
      >
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-teal-deep">{count != null ? peopleHere(count) : 'Live now'}</p>
        <h2 className="mt-2 font-serif text-[2.2rem] leading-tight">{space.name}</h2>
        <p className="mt-2 text-navy-soft">{space.description}</p>
        {prefs && (
          <div className="mt-6 flex justify-center gap-3">
            <DoorToggle label="Camera" on={prefs.camera && space.allowCamera} disabled={!space.allowCamera} hint={space.allowCamera ? undefined : 'Cameras are off in this room'} onChange={(v) => setPrefs({ ...prefs, camera: v })} />
            <DoorToggle label="Microphone" on={prefs.mic && space.allowMicrophone} disabled={!space.allowMicrophone} hint={space.allowMicrophone ? undefined : 'Microphones are off in this room'} onChange={(v) => setPrefs({ ...prefs, mic: v })} />
          </div>
        )}
        <Button size="lg" className="mt-6 w-full !text-base" onClick={onEnter} disabled={!prefs}>
          {behaviour.cta}
        </Button>
        <Link href={PLACES_HREF} className="mt-4 inline-block text-sm font-medium text-teal-deep hover:underline">
          Not now
        </Link>
      </motion.div>
    </div>
  )
}

function DoorToggle({ label, on, disabled, hint, onChange }: { label: string; on: boolean; disabled?: boolean; hint?: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={hint}
      onClick={() => onChange(!on)}
      className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50', on ? 'border-teal bg-teal-wash text-teal-deep' : 'border-line bg-white text-navy-soft')}
    >
      <span className={cn('relative h-5 w-9 rounded-full transition', on ? 'bg-teal' : 'bg-line')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label} {on ? 'on' : 'off'}
    </button>
  )
}

function StateCard({ title, body, actions, busy, icon, tone }: { title: string; body?: string; actions?: ReactNode; busy?: boolean; icon?: ReactNode; tone?: 'closed' }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center px-4" role="status" aria-live="polite">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-panel bg-white/90 p-7 text-center text-navy shadow-lift backdrop-blur-xl"
      >
        {busy ? (
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-teal" />
        ) : icon ? (
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal-wash text-teal-deep">{icon}</span>
        ) : tone === 'closed' ? (
          <RoomStatus live={false} />
        ) : null}
        <h2 className={cn('font-serif text-[1.8rem] leading-tight', (busy || icon || tone) && 'mt-3')}>{title}</h2>
        {body && <p className="mt-2 text-navy-soft">{body}</p>}
        {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
      </motion.div>
    </div>
  )
}

/** Rooms open to guests: drop in with just a name — no account, no friction. */
function GuestDoor({ space, onEnter }: { space: VirtualSpace; onEnter: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await dropInAsGuest(name)
      setTimeout(onEnter, 300) // let the guest identity settle, then step in
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  return (
    <div className="absolute inset-0 z-10 grid place-items-center px-4">
      <form onSubmit={go} className="w-full max-w-md rounded-panel bg-white/95 p-6 text-navy shadow-lift backdrop-blur md:p-8">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-teal-deep">Free · no account needed</p>
        <h2 className="mt-2 font-serif text-3xl leading-tight">{space.name}</h2>
        <p className="mt-2 text-navy-soft">{space.description}</p>
        <label className="mt-5 block text-sm font-medium" htmlFor="guest-name">
          Your name
        </label>
        <input
          id="guest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          autoFocus
          placeholder="How people will see you"
          className="mt-1.5 h-12 w-full rounded-2xl border border-line bg-white px-4 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-[#a2412c]">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy} className="mt-4 w-full !text-base">
          {busy ? 'Stepping in…' : 'Drop in'}
        </Button>
        <p className="mt-4 text-center text-sm text-muted">
          Already a member?{' '}
          <button type="button" onClick={() => openAuth({ mode: 'signin', onDone: () => setTimeout(onEnter, 300) })} className="font-medium text-teal-deep hover:underline">
            Sign in
          </button>
        </p>
      </form>
    </div>
  )
}

function BackToMyPlace() {
  return (
    <Link href={PLACES_HREF} className="inline-flex h-10 items-center rounded-full border border-line bg-white/70 px-5 text-sm font-medium text-navy hover:bg-white">
      Back to Virtual Places
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Inside                                                               */
/* ------------------------------------------------------------------ */

function useStageSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

const greeted = new Set<string>()

function InRoom({ session, space, quiet, onLeave }: { session: RoomSessionState; space: VirtualSpace; quiet: boolean; onLeave: () => void }) {
  const me = useMe()
  const [stageRef, stage] = useStageSize()
  const [focused, setFocused] = useState<string | null>(null)
  // Your circle while you drag it (committed to the room when you let go).
  const [drag, setDrag] = useState<Spot | null>(null)
  const dragged = useRef(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMode, setChatModeState] = useState<ChatMode>(() => savedChatMode())
  const setChatMode = (m: ChatMode) => {
    saveChatMode(m)
    setChatModeState(m)
  }
  const [chatSeenAt, setChatSeenAt] = useState(() => Date.now())
  // Your talking circle: shown unless you've turned it off (remembered on this device).
  const [showRing, setShowRingState] = useState(() => {
    try {
      return localStorage.getItem('places:spaces:ring') !== 'off'
    } catch {
      return true
    }
  })
  const setShowRing = (on: boolean) => {
    try {
      localStorage.setItem('places:spaces:ring', on ? 'on' : 'off')
    } catch {}
    setShowRingState(on)
  }
  const [musicOpen, setMusicOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const world = useWorld()
  const canPlayMusic = !!activePlan(world, 'pass') || (!!session.me && space.createdBy === session.me)
  // The room's host (or a PLACES admin) can change its background from here; the database checks it too.
  const admin = useAdminStatus() === 'admin'
  const canStyle = admin || (!space.isOfficial && !!session.me && space.createdBy === session.me)
  const [sceneOpen, setSceneOpen] = useState(false)
  const fresh = useFreshMessages(session.messages)
  // Greet once per visit, not every time you come back from another Place.
  const [welcome, setWelcome] = useState(() => Boolean(space.settings.welcome) && !greeted.has(`${space.id}:${session.me}`))
  useEffect(() => {
    greeted.add(`${space.id}:${session.me}`)
  }, [space.id, session.me])
  const [mediaNote, setMediaNote] = useState(true)

  useEffect(() => {
    if (!welcome) return
    const t = setTimeout(() => setWelcome(false), 12_000)
    return () => clearTimeout(t)
  }, [welcome])

  // Everyone in the room: presence says who's here, media supplies their video/audio when it can.
  const people = useMemo<BubblePerson[]>(() => {
    const remote = new Map(session.remote.map((r) => [r.identity, r]))
    const roster = session.roster.some((r) => r.userId === session.me)
      ? session.roster
      : [...(session.me ? [{ userId: session.me, displayName: me?.name ?? 'You', avatarUrl: me?.avatar ?? null, cameraOn: false, micOn: false, zone: null, x: null, y: null, scale: null, status: null, role: 'participant' as const, joinedAt: '', lastSeenAt: '' }] : []), ...session.roster]
    const list = roster.map<BubblePerson>((p) => {
      if (p.userId === session.me) {
        const l = session.local
        return {
          id: p.userId,
          name: me?.name ?? p.displayName,
          avatar: me?.avatar || p.avatarUrl,
          isLocal: true,
          cameraOn: session.camera === 'on',
          micOn: session.mic === 'on',
          speaking: !!l?.speaking,
          videoStream: l?.videoStream ?? null,
          audioStream: null,
        }
      }
      const m = remote.get(p.userId)
      return {
        id: p.userId,
        name: p.displayName,
        avatar: p.avatarUrl,
        isLocal: false,
        // Presence says whether their camera/mic is on; the connection (when near) carries the picture and sound.
        cameraOn: p.cameraOn,
        micOn: p.micOn,
        speaking: !!m?.speaking,
        videoStream: m?.videoStream ?? null,
        audioStream: m?.audioStream ?? null,
        videoUnavailable: !m?.videoStream && p.cameraOn,
      }
    })
    // You first, then everyone in the order they arrived — so nobody's spot shifts when others come and go.
    return list.sort((a, b) => Number(b.isLocal) - Number(a.isLocal))
  }, [session.roster, session.remote, session.local, session.me, session.camera, session.mic, me?.name, me?.avatar])

  const phone = stage.w < 640
  const layout = layoutBubbles(
    people.map((p) => ({ id: p.id, zone: session.roster.find((r) => r.userId === p.id)?.zone ?? null })),
    stage.w,
    stage.h,
    { minSize: phone ? 52 : 64, maxSize: phone ? (people.length <= 2 ? 120 : 100) : 136 },
  )
  const size = layout.size
  const presenceOf = (id: string) => session.roster.find((r) => r.userId === id)
  // Each bubble at its owner's chosen size, where the room allows it.
  const sizeOf = (id: string) => Math.round(size * (space.allowResize ? (presenceOf(id)?.scale ?? 1) : 1))
  // Until someone has a spot of their own, they stand where the crowd layout puts them.
  const fallback = new Map(layout.spots.map((s) => [s.id, s]))
  const posOf = (id: string): Spot | null => {
    if (id === session.me && drag) return drag
    const r = session.roster.find((x) => x.userId === id)
    return r && r.x != null && r.y != null ? { x: r.x, y: r.y } : null
  }
  const pixel = (id: string) => {
    const p = posOf(id)
    const s = sizeOf(id)
    if (p) return { x: Math.min(stage.w - s / 2, Math.max(s / 2, p.x * stage.w)), y: Math.min(stage.h - s / 2 - 22, Math.max(s / 2, p.y * stage.h)) }
    const f = fallback.get(id)
    return f ? { x: f.x, y: Math.min(f.y, stage.h - s / 2 - 22) } : null
  }
  const toSpot = (clientX: number, clientY: number): Spot => {
    const r = stageRef.current!.getBoundingClientRect()
    return clampSpot({ x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height })
  }
  const inside = session.phase === 'in-room'
  const mePx = session.me ? pixel(session.me) : null

  /** Drag your own circle to walk; a tap still opens it. */
  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !inside) return
    const el = e.currentTarget
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    dragged.current = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      // Take over the pointer only once it's really a drag, so a plain tap still reaches the bubble (and opens its card).
      if (!moved) el.setPointerCapture(ev.pointerId)
      moved = true
      setDrag(toSpot(ev.clientX, ev.clientY))
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!moved) return
      // Swallow the click that ends this drag (it fires right after), and nothing after it.
      dragged.current = true
      setTimeout(() => (dragged.current = false), 0)
      void roomSession.move(toSpot(ev.clientX, ev.clientY))
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const walkKeys = (e: React.KeyboardEvent) => {
    const cur = session.me ? posOf(session.me) : null
    const next = cur && step(cur, e.key)
    if (!next) return
    e.preventDefault()
    void roomSession.move(next)
  }
  const goTalk = (id: string) => {
    const them = posOf(id)
    const mine = session.me ? posOf(session.me) : null
    if (!them) return
    setFocused(null)
    // Stand right beside them: a circle's width (plus a little) to whichever side you're coming from.
    const dx = stage.w ? (size + 24) / stage.w : 0.12
    void roomSession.move(clampSpot({ x: them.x + ((mine?.x ?? 0) < them.x ? -dx : dx), y: them.y }))
  }

  // Speech bubbles: the latest fresh message from each person.
  const saying = new Map<string, string>()
  if (chatMode === 'bubbles') for (const m of fresh) saying.set(m.userId, m.body)
  // In bubbles mode messages show up beside people; in chat mode, new ones wait behind the Chat button.
  const unread = chatOpen || chatMode === 'bubbles' ? 0 : session.messages.filter((m) => m.userId !== session.me && (m.receivedAt ?? 0) > chatSeenAt).length
  const closeChat = () => {
    setChatSeenAt(Date.now())
    setChatOpen(false)
  }

  const notices: { key: string; text: string }[] = []
  if (session.camera === 'requesting') notices.push({ key: 'cam-req', text: 'Requesting camera permission…' })
  if (session.mic === 'requesting') notices.push({ key: 'mic-req', text: 'Requesting microphone permission…' })
  if (session.camera === 'denied') notices.push({ key: 'cam-denied', text: space.allowMicrophone ? 'Camera permission denied — you’re here with audio only. Allow the camera in your browser settings to turn it on.' : 'Camera permission denied. Allow it in your browser settings to turn it on.' })
  if (session.mic === 'denied') notices.push({ key: 'mic-denied', text: 'Microphone permission denied — you can still see and be seen. Allow the microphone in your browser settings to speak.' })
  if (session.camera === 'unavailable' || session.camera === 'in-use') notices.push({ key: 'cam-x', text: deviceHint[session.camera]('camera') + '.' })
  if (session.mic === 'unavailable' || session.mic === 'in-use') notices.push({ key: 'mic-x', text: deviceHint[session.mic]('microphone') + '.' })

  return (
    <>
      {/* Status line under the room name */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(76px+env(safe-area-inset-top))] z-20 flex flex-col items-center gap-2 px-4 md:top-[96px]">
        <AnimatePresence>
          {session.phase === 'reconnecting' && (
            <motion.p key="reconnecting" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="inline-flex items-center gap-2 rounded-full bg-[#fff1ee] px-4 py-2 text-sm font-medium text-[#a2412c] shadow-soft">
              <Loader2 className="h-4 w-4 animate-spin" /> Reconnecting…
            </motion.p>
          )}
          {welcome && space.settings.welcome && (
            <motion.div key="welcome" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-2xl bg-white/90 px-4 py-3 text-sm leading-snug text-navy shadow-lift backdrop-blur-xl">
              <p>{space.settings.welcome}</p>
              <button onClick={() => setWelcome(false)} aria-label="Dismiss" className="-mr-1 shrink-0 rounded-full p-0.5 text-muted hover:text-navy">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
          {notices.map((n) => (
            <motion.p key={n.key} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="max-w-lg rounded-2xl bg-navy/70 px-4 py-2 text-center text-[0.82rem] leading-snug text-white shadow-soft backdrop-blur-md">
              {n.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      {/* The people — drag your circle (or tap the floor) to walk around */}
      <div
        ref={stageRef}
        data-testid="room-floor"
        className="absolute inset-x-0 bottom-[calc(112px+env(safe-area-inset-bottom))] top-[calc(84px+env(safe-area-inset-top))] z-10 overflow-hidden md:bottom-[124px] md:top-[108px]"
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          if (focused) return setFocused(null)
          if (inside) void roomSession.move(toSpot(e.clientX, e.clientY))
        }}
      >
        {/* Talking distance: anyone inside this circle can see and hear you. */}
        {session.carriesRemoteMedia && showRing && mePx && stage.w > 0 && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute rounded-full border-2 border-dashed border-white/45 bg-white/[0.06]"
            style={{ width: 2 * (TALK_DISTANCE / ROOM_ASPECT) * stage.w, height: 2 * TALK_DISTANCE * stage.h }}
            animate={{ left: mePx.x - (TALK_DISTANCE / ROOM_ASPECT) * stage.w, top: mePx.y - TALK_DISTANCE * stage.h }}
            transition={drag ? { duration: 0 } : { type: 'spring', damping: 26, stiffness: 180 }}
            data-testid="talk-ring"
          />
        )}
        <AnimatePresence>
          {people.map((p) => {
            const px = pixel(p.id)
            if (!px) return null
            const said = saying.get(p.id)
            const low = px.y > stage.h * 0.55
            const s = sizeOf(p.id)
            const presence = presenceOf(p.id)
            return (
              <motion.div
                key={p.id}
                className={cn('absolute', p.isLocal && inside && 'cursor-grab touch-none active:cursor-grabbing')}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1, left: px.x - s / 2, top: px.y - s / 2 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={p.isLocal && drag ? { duration: 0 } : { type: 'spring', damping: 26, stiffness: 180 }}
                style={{ zIndex: focused === p.id ? 6 : said ? 5 : p.isLocal ? 3 : 1 }}
                onPointerDown={p.isLocal ? startDrag : undefined}
                data-testid={p.isLocal ? 'my-circle' : undefined}
              >
                <ParticipantBubble
                  person={{ ...p, nearby: session.nearby.includes(p.id), status: presence?.status ?? null }}
                  size={s}
                  focused={focused === p.id}
                  onFocus={() => {
                    if (p.isLocal && dragged.current) return
                    setFocused(focused === p.id ? null : p.id)
                  }}
                  onKeyDown={p.isLocal ? walkKeys : undefined}
                />
                <AnimatePresence>{said && <SpeechBubble key={said} text={said} side={px.x > stage.w * 0.62 ? 'left' : 'right'} />}</AnimatePresence>
                {focused === p.id && p.isLocal && inside && (
                  <MyBubbleCard
                    scale={presence?.scale ?? 1}
                    status={presence?.status ?? null}
                    allowResize={space.allowResize}
                    showRing={showRing}
                    onScale={(scale) => void roomSession.setLook({ scale })}
                    onStatus={(status) => void roomSession.setLook({ status })}
                    onRing={setShowRing}
                    className={cn('absolute left-1/2 -translate-x-1/2', low ? 'bottom-full mb-2' : 'top-full mt-2')}
                  />
                )}
                {focused === p.id && !p.isLocal && (
                  <PersonCard
                    id={p.id}
                    name={p.name}
                    nearby={session.nearby.includes(p.id)}
                    onGoTalk={() => goTalk(p.id)}
                    className={cn('absolute left-1/2 -translate-x-1/2', low ? 'bottom-full mb-2' : 'top-full mt-2')}
                  />
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {musicOpen && (
          <MusicPanel
            music={session.music}
            canPlay={canPlayMusic}
            listening={listening}
            onListen={setListening}
            onPlay={(trackId) => roomSession.setMusic(trackId)}
            onClose={() => setMusicOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sceneOpen && canStyle && (
          <RoomBackgroundPanel space={space} onClose={() => setSceneOpen(false)} />
        )}
      </AnimatePresence>
      {listening && session.music && <MusicPlayer music={session.music} onClose={() => setListening(false)} />}

      <AnimatePresence>{chatOpen && chatMode === 'panel' && <ChatPanel messages={session.messages} me={session.me} mode={chatMode} onMode={setChatMode} onClose={closeChat} />}</AnimatePresence>
      {chatOpen && chatMode === 'bubbles' && <BubbleComposer mode={chatMode} onMode={setChatMode} onClose={closeChat} />}

      {/* How the room works (live media), or honest about media when it can't connect */}
      {mediaNote && !chatOpen && !musicOpen && !sceneOpen && !(listening && session.music) && (
        <div className="absolute inset-x-0 bottom-[calc(118px+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 md:bottom-[132px]">
          <div className="flex max-w-xl items-start gap-2.5 rounded-2xl bg-white/88 px-4 py-2.5 text-[0.78rem] leading-snug text-navy-soft shadow-soft backdrop-blur-xl" data-testid="media-note">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" />
            {session.carriesRemoteMedia ? (
              <p>
                <span className="font-medium text-navy">Walk up to people to talk.</span> Drag your circle — or tap the floor — to move. Anyone inside your dashed circle can see and hear you.
              </p>
            ) : (
              <p>
                <span className="font-medium text-navy">Live video between people isn’t switched on here.</span>{' '}
                <span className="hidden sm:inline">You can see who’s here and chat, and your own camera and mic work on your side.</span>
                <span className="sm:hidden">You can see who’s here and chat.</span>
              </p>
            )}
            <button onClick={() => setMediaNote(false)} aria-label="Dismiss" className="shrink-0 rounded-full p-0.5 text-muted hover:text-navy">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!me && (
        // Guests: a gentle way into the rest of PLACES, never in the way of the room.
        <div className="absolute left-4 top-20 z-30 max-w-[15rem] rounded-2xl bg-white/90 p-3 text-sm text-navy shadow-soft backdrop-blur md:left-6 md:top-24">
          <p className="font-medium">You’re here as a guest.</p>
          <p className="mt-0.5 text-xs text-navy-soft">PLACES is free: a profile, courses, a marketplace and work — all in one place.</p>
          <button onClick={() => openAuth({ mode: 'join', reason: 'Make your own place in PLACES — it’s free.' })} className="mt-2 text-xs font-semibold text-teal-deep hover:underline">
            Join PLACES FOR US free →
          </button>
        </div>
      )}

      <div className="pb-safe absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 md:pb-6">
        <div>
          <RoomControls
            camera={session.camera}
            mic={session.mic}
            onCamera={() => {
              saveDevicePrefs({ camera: session.camera !== 'on' })
              void roomSession.toggleCamera()
            }}
            onMic={() => {
              if (!quiet) saveDevicePrefs({ mic: session.mic !== 'on' })
              void roomSession.toggleMic()
            }}
            onLeave={onLeave}
            chatOpen={chatOpen}
            unread={unread}
            musicOn={!!session.music}
            musicOpen={musicOpen}
            onMusic={() => {
              setMusicOpen((v) => !v)
              setChatOpen(false)
              setSceneOpen(false)
            }}
            backgroundOpen={sceneOpen}
            onBackground={
              canStyle
                ? () => {
                    setSceneOpen((v) => !v)
                    setMusicOpen(false)
                    setChatOpen(false)
                  }
                : undefined
            }
            onChat={() => {
              setMusicOpen(false)
              setSceneOpen(false)
              setChatSeenAt(Date.now())
              setChatOpen((v) => !v)
            }}
          />
        </div>
      </div>
    </>
  )
}
