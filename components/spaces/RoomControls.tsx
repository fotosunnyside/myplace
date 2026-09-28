'use client'

import { DoorOpen, Loader2, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import type { DeviceState } from '@/lib/spaces/session'
import { cn } from '@/lib/cn'

const deviceHint: Record<DeviceState, (d: 'camera' | 'microphone') => string> = {
  off: (d) => (d === 'camera' ? 'Turn camera on' : 'Unmute'),
  on: (d) => (d === 'camera' ? 'Turn camera off' : 'Mute'),
  requesting: (d) => `Requesting ${d} permission…`,
  denied: (d) => `${d === 'camera' ? 'Camera' : 'Microphone'} blocked — allow it in your browser settings`,
  unavailable: (d) => `No ${d} found`,
  'in-use': (d) => `Your ${d} is in use by another app`,
  blocked: (d) => `${d === 'camera' ? 'Cameras' : 'Microphones'} are off in this room`,
}

function DeviceButton({ device, state, onClick }: { device: 'camera' | 'microphone'; state: DeviceState; onClick: () => void }) {
  const on = state === 'on'
  const problem = state === 'denied' || state === 'unavailable' || state === 'in-use'
  const Icon = state === 'requesting' ? Loader2 : device === 'camera' ? (on ? Video : VideoOff) : on ? Mic : MicOff
  const label = device === 'camera' ? 'Camera' : 'Mic'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'blocked' || state === 'requesting'}
      aria-pressed={on}
      aria-label={deviceHint[state](device)}
      title={deviceHint[state](device)}
      className={cn(
        'group relative flex flex-col items-center gap-1 text-[0.68rem] font-medium transition disabled:opacity-60',
        on ? 'text-white' : 'text-white/85',
      )}
    >
      <span
        className={cn(
          'grid h-12 w-12 place-items-center rounded-full transition duration-300 ease-gentle active:scale-95 md:h-[52px] md:w-[52px]',
          on ? 'bg-white text-navy shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)]' : 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25',
          problem && 'ring-2 ring-coral/80',
        )}
      >
        <Icon className={cn('h-[22px] w-[22px]', state === 'requesting' && 'animate-spin')} strokeWidth={1.9} />
      </span>
      {label}
      {problem && <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-coral ring-2 ring-navy/40" aria-hidden />}
    </button>
  )
}

/** Three quiet controls: camera, mic, leave. */
export function RoomControls({ camera, mic, onCamera, onMic, onLeave }: { camera: DeviceState; mic: DeviceState; onCamera: () => void; onMic: () => void; onLeave: () => void }) {
  return (
    <div role="toolbar" aria-label="Room controls" className="flex items-end gap-5 rounded-full bg-navy/45 px-6 py-3 shadow-[0_18px_50px_-18px_rgb(0_0_0/0.6)] ring-1 ring-white/15 backdrop-blur-xl md:gap-7 md:px-8">
      <DeviceButton device="microphone" state={mic} onClick={onMic} />
      <DeviceButton device="camera" state={camera} onClick={onCamera} />
      <button type="button" onClick={onLeave} className="flex flex-col items-center gap-1 text-[0.68rem] font-medium text-white/90">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e0735b] text-white shadow-[0_10px_24px_-12px_rgb(224_115_91/0.9)] transition duration-300 ease-gentle hover:bg-[#cf6048] active:scale-95 md:h-[52px] md:w-[52px]">
          <DoorOpen className="h-[22px] w-[22px]" strokeWidth={1.9} />
        </span>
        Leave
      </button>
    </div>
  )
}

export { deviceHint }
