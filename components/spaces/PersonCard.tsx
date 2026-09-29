'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Footprints, MessageCircle, UserCheck, UserPlus } from 'lucide-react'
import { openThread, toggleFollow } from '@/lib/store/actions'
import { perform, useWorld } from '@/lib/store/hooks'
import { isFollowing } from '@/lib/store/selectors'
import { openAuth } from '@/lib/ui'
import { cn } from '@/lib/cn'

/**
 * Tap someone in the room: walk over to talk, add them as a friend (they show up in YourPlace → Friends),
 * message them, or visit their YourPlace. Guests are invited to join first.
 */
export function PersonCard({ id, name, nearby, onGoTalk, className }: { id: string; name: string; nearby: boolean; onGoTalk: () => void; className?: string }) {
  const world = useWorld()
  const router = useRouter()
  const person = world.people.find((p) => p.id === id)
  const signedIn = !!world.accountId
  const friends = signedIn && isFollowing(world, id)
  const first = name.split(' ')[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('z-30 w-56 rounded-2xl bg-white/95 p-3 text-left text-navy shadow-lift backdrop-blur-xl', className)}
      role="dialog"
      aria-label={name}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="truncate font-semibold">{name}</p>
      <p className="text-xs text-navy-soft">{nearby ? 'Close enough to talk' : 'Walk over to see and hear each other'}</p>
      <div className="mt-2.5 grid gap-1.5">
        {!nearby && (
          <button type="button" onClick={onGoTalk} className="flex items-center gap-2 rounded-xl bg-teal px-3 py-2 text-sm font-medium text-white hover:bg-teal-deep">
            <Footprints className="h-4 w-4" /> Go talk to {first}
          </button>
        )}
        {person ? (
          <>
            <button
              type="button"
              onClick={() => perform((s) => toggleFollow(s, id), friends ? `Removed ${first} from your friends.` : `${first} is in your friends — find them in YourPlace.`)}
              className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium', friends ? 'bg-teal-wash text-teal-deep' : 'bg-ivory hover:bg-sand')}
              aria-pressed={friends}
            >
              {friends ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {friends ? 'Friends' : 'Add friend'}
            </button>
            <button
              type="button"
              onClick={() => {
                const r = perform((s, now) => openThread(s, id, undefined, now))
                if (r.ok) router.push(`/messages/?t=${r.id}`)
              }}
              className="flex items-center gap-2 rounded-xl bg-ivory px-3 py-2 text-sm font-medium hover:bg-sand"
            >
              <MessageCircle className="h-4 w-4" /> Message
            </button>
            <Link href={`/people/?u=${person.username}`} className="px-3 pt-1 text-xs font-medium text-teal-deep hover:underline">
              Visit {first}’s YourPlace →
            </Link>
          </>
        ) : !signedIn ? (
          <button
            type="button"
            onClick={() => openAuth({ mode: 'join', reason: `Join PLACES FOR US to add ${first} as a friend.` })}
            className="flex items-center gap-2 rounded-xl bg-ivory px-3 py-2 text-sm font-medium hover:bg-sand"
          >
            <UserPlus className="h-4 w-4" /> Join to add friends
          </button>
        ) : (
          <p className="px-1 text-xs text-muted">{first} is visiting as a guest.</p>
        )}
      </div>
    </motion.div>
  )
}
