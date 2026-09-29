'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Compass, Info, Loader2, Timer, Users, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DistrictIcon } from '@/components/districts/DistrictIcon'
import { Button } from '@/components/ui/primitives'
import { useBackendSession } from '@/lib/backend/auth'
import { backendConfigured } from '@/lib/backend/client'
import { layoutBubbles } from '@/lib/spaces/layout'
import { devicePrefs, roomSession, saveDevicePrefs, useRoomSession } from '@/lib/spaces/live'
import { peopleHere, roomBehaviour } from '@/lib/spaces/rooms'
import type { RoomSessionState } from '@/lib/spaces/session'
import { useOccupancy, useSpaces } from '@/lib/spaces/store'
import type { VirtualSpace } from '@/lib/spaces/types'
import { useHydrated, useMe } from '@/lib/store/hooks'
import { orderedDistricts } from '@/lib/world/districts'
import { openAuth } from '@/lib/ui'
import { cn } from '@/lib/cn'
import { ParticipantBubble, type BubblePerson } from './ParticipantBubble'
import { deviceHint, RoomControls } from './RoomControls'
import { RoomBackdrop } from './RoomBackdrop'
import { RoomStatus } from './SpaceCard'

/** /myplace/space/?room=<slug> — resolves the room from live configuration, then hands it to the shared room engine. */
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
          title={loading ? 'Finding the room…' : spaces.status === 'error' ? 'We couldn’t reach PLACES' : 'We couldn’t find that room'}
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

  const profile = account ? { name: account.name, avatar: account.avatar } : null
  const cloudPending = backendConfigured && cloud.status === 'loading'
  const signedIn = !!account && (!backendConfigured || cloud.status === 'signed-in')

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
    router.replace(`/myplace/space/?room=${space.slug}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnter, prefs, cloudPending, signedIn, space.isActive])

  const leave = async () => {
    await roomSession.leave()
    router.push('/myplace')
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
            href="/myplace"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/85 text-navy shadow-soft backdrop-blur-md transition hover:bg-white md:h-11 md:w-auto md:gap-1 md:px-4 md:pr-5 md:text-sm md:font-medium"
            aria-label={inside ? 'Spaces (you’ll stay in the room)' : 'Back to Spaces'}
          >
            <span className="flex items-center gap-1">
              <ChevronLeft className="h-5 w-5" />
              <span className="hidden md:inline">Spaces</span>
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

  if (!signedIn || phase === 'signin')
    return (
      <StateCard
        title={`Enter ${space.name}`}
        body={hasAccount ? 'Sign in with your PLACES password to enter live spaces.' : 'Live spaces are free for everyone with a PLACES account.'}
        actions={
          <>
            <Button onClick={() => openAuth({ mode: hasAccount ? 'signin' : 'join', reason: `Rooms are free for PLACES members.`, onDone: () => setTimeout(onEnter, 300) })}>
              {hasAccount ? 'Sign in to enter' : 'Join PLACES'}
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
        <Link href="/myplace" className="mt-4 inline-block text-sm font-medium text-teal-deep hover:underline">
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

function BackToMyPlace() {
  return (
    <Link href="/myplace" className="inline-flex h-10 items-center rounded-full border border-line bg-white/70 px-5 text-sm font-medium text-navy hover:bg-white">
      Back to Spaces
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
  // Greet once per visit, not every time you come back from another Place.
  const [welcome, setWelcome] = useState(() => Boolean(space.settings.welcome) && !greeted.has(`${space.id}:${session.me}`))
  useEffect(() => {
    greeted.add(`${space.id}:${session.me}`)
  }, [space.id, session.me])
  const [mediaNote, setMediaNote] = useState(!session.carriesRemoteMedia)

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
      : [...(session.me ? [{ userId: session.me, displayName: me?.name ?? 'You', avatarUrl: me?.avatar ?? null, cameraOn: false, micOn: false, zone: null, role: 'participant' as const, joinedAt: '', lastSeenAt: '' }] : []), ...session.roster]
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
        cameraOn: m ? m.cameraOn : p.cameraOn,
        micOn: m ? m.micOn : p.micOn,
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
    { minSize: phone ? 60 : 76, maxSize: phone ? (people.length <= 2 ? 150 : 128) : 184 },
  )
  const spot = new Map(layout.spots.map((s) => [s.id, s]))

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

      {/* The people */}
      <div ref={stageRef} className="absolute inset-x-0 bottom-[calc(112px+env(safe-area-inset-bottom))] top-[calc(84px+env(safe-area-inset-top))] z-10 overflow-y-auto overflow-x-hidden md:bottom-[124px] md:top-[108px]" onClick={(e) => e.target === e.currentTarget && setFocused(null)}>
        <div className="relative" style={{ height: layout.height }}>
          <AnimatePresence>
            {people.map((p) => {
              const s = spot.get(p.id)
              if (!s) return null
              return (
                <motion.div
                  key={p.id}
                  className="absolute"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1, left: s.x - s.size / 2, top: s.y - s.size / 2 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 180 }}
                  style={{ zIndex: focused === p.id ? 5 : 1 }}
                >
                  <ParticipantBubble person={p} size={s.size} focused={focused === p.id} onFocus={() => setFocused(focused === p.id ? null : p.id)} />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Honest about media until a live provider is connected */}
      {mediaNote && !session.carriesRemoteMedia && (
        <div className="absolute inset-x-0 bottom-[calc(118px+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 md:bottom-[132px]">
          <div className="flex max-w-xl items-start gap-2.5 rounded-2xl bg-white/88 px-4 py-2.5 text-[0.78rem] leading-snug text-navy-soft shadow-soft backdrop-blur-xl" data-testid="media-note">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" />
            <p>
              <span className="font-medium text-navy">Live video between people isn’t switched on yet.</span>{' '}
              <span className="hidden sm:inline">You can see who’s here, and your own camera and mic work — others will see and hear you once PLACES connects its live video service.</span>
              <span className="sm:hidden">You can see who’s here; your camera and mic work on your side for now.</span>
            </p>
            <button onClick={() => setMediaNote(false)} aria-label="Dismiss" className="shrink-0 rounded-full p-0.5 text-muted hover:text-navy">
              <X className="h-4 w-4" />
            </button>
          </div>
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
          />
        </div>
      </div>
    </>
  )
}
