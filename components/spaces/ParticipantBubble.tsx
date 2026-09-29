'use client'

import { MicOff, Video } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Avatar } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

export interface BubblePerson {
  id: string
  name: string
  avatar?: string | null
  isLocal: boolean
  cameraOn: boolean
  micOn: boolean
  speaking: boolean
  videoStream: MediaStream | null
  audioStream: MediaStream | null
  /** Camera is on at their end but their video isn't reaching us (too far away to connect, or no live media). */
  videoUnavailable?: boolean
  /** Close enough to see and hear each other. */
  nearby?: boolean
}

function StreamVideo({ stream, mirror }: { stream: MediaStream; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    el.play().catch(() => {})
    return () => {
      el.srcObject = null
    }
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted className={cn('absolute inset-0 h-full w-full object-cover', mirror && '-scale-x-100')} />
}

function StreamAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    el.play().catch(() => {})
    return () => {
      el.srcObject = null
    }
  }, [stream])
  return <audio ref={ref} autoPlay />
}

const statusText = (p: BubblePerson) =>
  [p.isLocal ? 'You' : null, p.nearby ? 'Nearby' : null, p.micOn ? (p.speaking ? 'Speaking' : 'Mic on') : 'Muted', p.cameraOn ? (p.videoUnavailable ? 'Camera on' : null) : 'Camera off'].filter(Boolean).join(' · ')

/** A person in the room: a round live-video bubble (or their photo), their name, and their mic/camera status. */
export function ParticipantBubble({
  person,
  size,
  focused,
  onFocus,
  onKeyDown,
}: {
  person: BubblePerson
  size: number
  focused: boolean
  onFocus: () => void
  onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  const showVideo = person.cameraOn && person.videoStream
  const badge = Math.max(22, Math.round(size * 0.2))

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <button
        type="button"
        onClick={onFocus}
        onKeyDown={onKeyDown}
        aria-label={`${person.isLocal ? 'You' : person.name}: ${statusText(person)}`}
        aria-pressed={focused}
        className={cn(
          'relative rounded-full transition-[box-shadow,transform] duration-300 ease-gentle focus-visible:outline-offset-4',
          person.speaking
            ? 'shadow-[0_0_0_4px_rgb(88_200_198/0.95),0_0_0_10px_rgb(88_200_198/0.28),0_18px_40px_-14px_rgb(0_0_0/0.55)]'
            : person.nearby
              ? 'shadow-[0_0_0_3px_rgb(255_255_255/0.95),0_0_0_6px_rgb(88_200_198/0.7),0_18px_40px_-14px_rgb(0_0_0/0.55)]'
              : 'shadow-[0_0_0_3px_rgb(255_255_255/0.92),0_18px_40px_-14px_rgb(0_0_0/0.55)]',
          focused && 'scale-[1.04]',
        )}
        style={{ width: size, height: size }}
      >
        <span className="absolute inset-0 overflow-hidden rounded-full bg-gradient-to-br from-aqua to-teal-deep">
          {showVideo ? (
            <StreamVideo stream={person.videoStream!} mirror={person.isLocal} />
          ) : (
            <Avatar src={person.avatar ?? undefined} alt="" name={person.name} size={size} className="!rounded-full" />
          )}
        </span>
        {!person.micOn && (
          <span
            className="absolute bottom-[4%] right-[4%] grid place-items-center rounded-full bg-white text-[#c9634d] shadow-soft ring-2 ring-white"
            style={{ width: badge, height: badge }}
            aria-hidden
          >
            <MicOff style={{ width: badge * 0.55, height: badge * 0.55 }} strokeWidth={2.2} />
          </span>
        )}
        {person.videoUnavailable && (
          <span
            className="absolute left-[4%] top-[4%] grid place-items-center rounded-full bg-navy/70 text-white shadow-soft backdrop-blur"
            style={{ width: badge, height: badge }}
            title="Their camera is on — walk closer to see them."
            aria-hidden
          >
            <Video style={{ width: badge * 0.55, height: badge * 0.55 }} strokeWidth={2} />
          </span>
        )}
      </button>
      <span
        className={cn(
          'relative z-10 -mt-3 max-w-[calc(100%+24px)] truncate rounded-full bg-white/92 px-2.5 py-0.5 text-center font-medium text-navy shadow-soft backdrop-blur',
          size < 80 ? 'text-[0.66rem]' : 'text-xs',
        )}
      >
        {person.isLocal ? 'You' : person.name.split(' ')[0]}
      </span>
      {focused && person.isLocal && <span className="mt-1 whitespace-nowrap rounded-full bg-navy/75 px-2.5 py-0.5 text-[0.68rem] text-white backdrop-blur">{statusText(person)}</span>}
      {!person.isLocal && person.audioStream && <StreamAudio stream={person.audioStream} />}
    </div>
  )
}
