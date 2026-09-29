'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Send } from 'lucide-react'
import { useState } from 'react'
import { SaveButton, TimeAgo, UpvoteButton } from '@/components/cards'
import { Avatar, Card, Tag } from '@/components/ui/primitives'
import { replyToDiscussion } from '@/lib/store/actions'
import { perform, useWorld, withAuth } from '@/lib/store/hooks'
import { count, formatCount, person } from '@/lib/store/selectors'
import { NotFoundHere, Shell } from './Shell'

export function DiscussionDetail() {
  const id = useSearchParams().get('id')
  const world = useWorld()
  const [draft, setDraft] = useState('')
  const d = world.discussions.find((x) => x.id === id)

  if (!d)
    return (
      <Shell back={{ href: '/mindplace', label: 'MindPlace' }} width="max-w-3xl">
        <NotFoundHere what="discussion" href="/mindplace" label="Back to MindPlace" />
      </Shell>
    )

  const author = person(world, d.authorId)
  const up = !!world.accountId && d.upvoters.includes(world.accountId)
  const earlier = (d.baseReplies ?? 0)

  return (
    <Shell back={{ href: '/mindplace', label: 'MindPlace' }} width="max-w-3xl">
      <article>
        <Tag tone={d.tone}>{d.category}</Tag>
        <h1 className="mt-3 font-serif text-[clamp(2rem,4.5vw,3rem)] leading-[1.05]">{d.title}</h1>
        <Link href={`/people/?u=${author.username}`} className="mt-4 flex items-center gap-3">
          <Avatar src={author.avatar} alt="" name={author.name} size={40} />
          <span className="text-sm">
            <span className="block font-semibold">{author.name}</span>
            <TimeAgo ts={d.createdAt} className="text-muted" />
          </span>
        </Link>
        {d.body && <p className="mt-5 whitespace-pre-line text-lg leading-relaxed text-navy-soft">{d.body}</p>}
        <div className="mt-6 flex items-center gap-3">
          <UpvoteButton d={d} up={up} big />
          <SaveButton refItem={{ kind: 'discussion', refId: d.id }} label className="h-10 rounded-full border border-line bg-white px-4 text-sm font-medium" />
        </div>
      </article>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{formatCount(count(d.baseReplies, d.replies.length))} replies</h2>
        {earlier > 0 && <p className="mt-1 text-sm text-muted">Showing the latest replies.</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            withAuth(() => {
              if (perform((s, now) => replyToDiscussion(s, d.id, draft, now), 'Reply posted.').ok) setDraft('')
            }, 'Join PLACES FOR US to reply.')
          }}
          className="mt-4 flex items-end gap-2 rounded-3xl border border-line bg-white p-2 pl-5"
        >
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Share what you know…" aria-label="Write a reply" className="min-w-0 flex-1 resize-none bg-transparent py-2 outline-none" />
          <button aria-label="Post reply" className="grid h-10 w-10 place-items-center rounded-full bg-teal text-white">
            <Send className="h-4 w-4" />
          </button>
        </form>
        <ul className="mt-5 grid gap-3">
          {[...d.replies].reverse().map((r) => {
            const a = person(world, r.authorId)
            return (
              <li key={r.id}>
                <Card className="flex gap-3 p-4">
                  <Avatar src={a.avatar} alt="" name={a.name} size={36} />
                  <div>
                    <p className="text-sm">
                      <Link href={`/people/?u=${a.username}`} className="font-semibold hover:underline">
                        {a.name}
                      </Link>{' '}
                      <TimeAgo ts={r.createdAt} className="text-muted" />
                    </p>
                    <p className="mt-1 whitespace-pre-line leading-relaxed text-navy-soft">{r.body}</p>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>
    </Shell>
  )
}
