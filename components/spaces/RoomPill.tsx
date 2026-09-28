'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { DoorOpen, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Avatar } from '@/components/ui/primitives'
import { roomSession, useRoomSession } from '@/lib/spaces/live'
import { useMe } from '@/lib/store/hooks'
import { cn } from '@/lib/cn'

/** While you look around PLACES, your room goes with you: who you are there, your mic and camera, and the way back. */
export function RoomPill() {
  const session = useRoomSession()
  const me = useMe()
  const pathname = usePathname().replace(/\/$/, '')
  const video = useRef<HTMLVideoElement>(null)
  const stream = session.camera === 'on' ? (session.local?.videoStream ?? null) : null
  const inside = (session.phase === 'in-room' || session.phase === 'reconnecting') && !!session.space
  const show = inside && pathname !== '/myplace/space'

  useEffect(() => {
    if (video.current) video.current.srcObject = stream
  }, [stream, show])

  return (
    <AnimatePresence>
      {show && session.space && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0"
          role="region"
          aria-label={`You're in ${session.space.name}`}
        >
          <div className="flex items-center gap-2 rounded-full bg-navy/90 py-1.5 pl-1.5 pr-2 text-white shadow-lift ring-1 ring-white/10 backdrop-blur-xl">
            <Link href={`/myplace/space/?room=${session.space.slug}`} className="flex items-center gap-2.5 rounded-full pr-2" aria-label={`Return to ${session.space.name}`}>
              <span className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/80">
                {stream ? <video ref={video} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" /> : <Avatar src={me?.avatar} alt="" name={me?.name ?? 'You'} size={40} />}
              </span>
              <span className="leading-tight">
                <span className="block text-[0.62rem] uppercase tracking-[0.18em] text-aqua">{session.phase === 'reconnecting' ? 'Reconnecting…' : 'You’re in'}</span>
                <span className="block max-w-[9rem] truncate text-sm font-medium">{session.space.name}</span>
              </span>
            </Link>
            <PillButton on={session.mic === 'on'} disabled={session.mic === 'blocked'} label={session.mic === 'on' ? 'Mute' : 'Unmute'} onClick={() => void roomSession.toggleMic()}>
              {session.mic === 'on' ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </PillButton>
            <PillButton on={session.camera === 'on'} disabled={session.camera === 'blocked'} label={session.camera === 'on' ? 'Turn camera off' : 'Turn camera on'} onClick={() => void roomSession.toggleCamera()}>
              {session.camera === 'on' ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </PillButton>
            <button onClick={() => void roomSession.leave()} aria-label={`Leave ${session.space.name}`} className="grid h-9 w-9 place-items-center rounded-full bg-[#e0735b] transition hover:bg-[#cf6048]">
              <DoorOpen className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PillButton({ on, disabled, label, onClick, children }: { on: boolean; disabled?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={on} className={cn('grid h-9 w-9 place-items-center rounded-full transition disabled:opacity-40', on ? 'bg-white text-navy' : 'bg-white/15 text-white hover:bg-white/25')}>
      {children}
    </button>
  )
}
