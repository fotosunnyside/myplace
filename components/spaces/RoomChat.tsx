'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { MessageSquare, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { roomSession } from '@/lib/spaces/live'
import type { RoomMessage } from '@/lib/spaces/types'
import { cn } from '@/lib/cn'

/** How chat shows up: a chat panel, or speech bubbles beside people's circles. Remembered on this device. */
export type ChatMode = 'panel' | 'bubbles'
const MODE_KEY = 'places:spaces:chat-mode'
export function savedChatMode(): ChatMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'panel' ? 'panel' : 'bubbles'
  } catch {
    return 'bubbles'
  }
}
export function saveChatMode(m: ChatMode) {
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {}
}

/** How long a speech bubble stays beside someone's circle. */
export const BUBBLE_MS = 8_000

/** Messages that arrived in the last few seconds — shown as bubbles. Chat history never pops up. */
export function useFreshMessages(messages: RoomMessage[]) {
  const [now, setNow] = useState(() => Date.now())
  const latest = messages.reduce((t, m) => Math.max(t, m.receivedAt ?? 0), 0)
  useEffect(() => {
    if (!latest) return
    const t = setInterval(() => {
      setNow(Date.now())
      if (Date.now() - latest > BUBBLE_MS) clearInterval(t)
    }, 500)
    return () => clearInterval(t)
  }, [latest])
  return messages.filter((m) => m.receivedAt && Math.max(now, m.receivedAt) - m.receivedAt < BUBBLE_MS)
}

/** A speech bubble beside someone's circle. */
export function SpeechBubble({ text, side }: { text: string; side: 'left' | 'right' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        'pointer-events-none absolute bottom-[70%] z-20 w-max max-w-[min(15rem,60vw)] rounded-2xl bg-white px-3 py-2 text-left text-[0.8rem] leading-snug text-navy shadow-lift',
        side === 'right' ? 'left-[82%] rounded-bl-md' : 'right-[82%] rounded-br-md',
      )}
      data-testid="speech-bubble"
    >
      {text}
    </motion.div>
  )
}

/** Type a message. Shown above the room controls in bubbles mode, and inside the panel in chat mode. */
export function ChatComposer({ onClose, autoFocus, className }: { onClose?: () => void; autoFocus?: boolean; className?: string }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError('')
    try {
      await roomSession.say(body)
      setText('')
    } catch (err) {
      setError((err as Error).message || 'That message didn’t send. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={send} className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2 rounded-full bg-white/95 p-1.5 pl-4 shadow-lift">
        <label htmlFor="room-chat" className="sr-only">
          Message the room
        </label>
        <input
          id="room-chat"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder="Say something to the room…"
          className="min-w-0 flex-1 bg-transparent text-sm text-navy outline-none placeholder:text-muted"
          onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Send"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal text-white transition hover:bg-teal-deep disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-full bg-[#fff1ee] px-3 py-1 text-xs text-[#a2412c]">
          {error}
        </p>
      )}
    </form>
  )
}

/** Chat or bubbles — the person chooses. */
export function ChatModeSwitch({ mode, onMode }: { mode: ChatMode; onMode: (m: ChatMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Show messages as" className="inline-flex rounded-full bg-navy/10 p-0.5 text-xs font-medium">
      {(
        [
          ['bubbles', 'Bubbles'],
          ['panel', 'Chat'],
        ] as const
      ).map(([m, label]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => onMode(m)}
          className={cn('rounded-full px-3 py-1 transition', mode === m ? 'bg-white text-navy shadow-soft' : 'text-navy-soft hover:text-navy')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** The chat panel: the room's conversation, newest at the bottom. */
export function ChatPanel({ messages, me, mode, onMode, onClose }: { messages: RoomMessage[]; me: string | null; mode: ChatMode; onMode: (m: ChatMode) => void; onClose: () => void }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [messages.length])
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      aria-label="Room chat"
      className="absolute bottom-[calc(112px+env(safe-area-inset-bottom))] right-3 top-[calc(84px+env(safe-area-inset-top))] z-30 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-panel bg-white/95 text-navy shadow-lift backdrop-blur-xl md:bottom-[124px] md:right-6 md:top-[108px]"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <MessageSquare className="h-4 w-4 text-teal-deep" /> Room chat
        </p>
        <div className="flex items-center gap-2">
          <ChatModeSwitch mode={mode} onMode={onMode} />
          <button onClick={onClose} aria-label="Close chat" className="rounded-full p-1 text-muted hover:text-navy">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length === 0 && <p className="py-6 text-center text-sm text-muted">No messages yet. Say hello!</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex flex-col', m.userId === me ? 'items-end' : 'items-start')}>
            {m.userId !== me && <span className="mb-0.5 px-1 text-[0.7rem] font-medium text-muted">{m.name}</span>}
            <p className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug', m.userId === me ? 'rounded-br-md bg-teal text-white' : 'rounded-bl-md bg-ivory text-navy')}>{m.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="border-t border-line/70 p-2">
        <ChatComposer autoFocus onClose={onClose} className="[&>div]:bg-ivory [&>div]:shadow-none" />
      </div>
    </motion.aside>
  )
}

/** The bubbles-mode composer, floating above the room controls. */
export function BubbleComposer({ mode, onMode, onClose }: { mode: ChatMode; onMode: (m: ChatMode) => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="absolute inset-x-0 bottom-[calc(112px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-[124px]"
      >
        <div className="flex w-full max-w-lg flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-white/90 px-2 py-1 shadow-soft backdrop-blur">
            <span className="pl-1 text-xs text-navy-soft">Show messages as</span>
            <ChatModeSwitch mode={mode} onMode={onMode} />
            <button onClick={onClose} aria-label="Close chat" className="rounded-full p-1 text-muted hover:text-navy">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ChatComposer autoFocus onClose={onClose} className="w-full" />
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
