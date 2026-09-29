'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, MapPin, MessageCircle, Trash2, Wallet, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SaveButton, TimeAgo, oppIcons, oppTones } from '@/components/cards'
import { TextArea, TextField } from '@/components/ui/fields'
import { Avatar, Button, Card, Tag } from '@/components/ui/primitives'
import { apply, createOpportunity, deleteOpportunity, hire, openThread, type OpportunityInput } from '@/lib/store/actions'
import { perform, useHydrated, useWorld, withAuth } from '@/lib/store/hooks'
import { PENDING_JOB } from '@/components/app/CreateDialogs'
import { person } from '@/lib/store/selectors'
import { cn } from '@/lib/cn'
import { NotFoundHere, Shell } from './Shell'

export function OpportunityDetail() {
  const params = useSearchParams()
  const id = params.get('id')
  const publish = params.get('publish') === '1'
  const world = useWorld()
  const ready = useHydrated()
  const handled = useRef(false)
  const router = useRouter()

  // Back from paying the job-post fee on Stripe: publish the saved draft.
  useEffect(() => {
    if (!ready || !publish || handled.current) return
    handled.current = true
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING_JOB) ?? 'null') as { input: OpportunityInput; at: number } | null
      if (pending && Date.now() - pending.at < 6 * 3_600_000 && world.accountId) {
        const r = perform((s, now) => createOpportunity(s, pending.input, now, 'stripe'), 'Payment received — your opportunity is live!')
        sessionStorage.removeItem(PENDING_JOB)
        if (r.ok) return router.replace(`/workplace/opportunity/?id=${r.id}`)
      }
    } catch {}
    router.replace('/workplace')
  }, [ready, publish, world.accountId, router])
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const o = world.opportunities.find((x) => x.id === id)

  if (publish) return <Shell width="max-w-4xl">{null}</Shell>
  if (!o)
    return (
      <Shell back={{ href: '/workplace', label: 'WorkPlace' }} width="max-w-4xl">
        <NotFoundHere what="opportunity" href="/workplace" label="Back to WorkPlace" />
      </Shell>
    )

  const poster = person(world, o.postedById)
  const mine = o.postedById === world.accountId
  const myApp = world.applications.find((a) => a.opportunityId === o.id && a.applicantId === world.accountId)
  const applicants = world.applications.filter((a) => a.opportunityId === o.id)
  const Icon = oppIcons[o.icon]

  return (
    <Shell back={{ href: '/workplace', label: 'WorkPlace' }} width="max-w-4xl">
      <div className="flex items-start gap-5">
        <span className={cn('grid h-16 w-16 shrink-0 place-items-center rounded-2xl', oppTones[o.iconTone])}>
          <Icon className="h-8 w-8" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-teal-deep">{o.org}</p>
          <h1 className="font-serif text-[clamp(2rem,4.5vw,3rem)] leading-[1.05]">{o.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-teal" /> {o.location} · {o.type}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-teal" /> {o.pay}
            </span>
            <span>
              Posted <TimeAgo ts={o.createdAt} />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {o.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>
        <SaveButton refItem={{ kind: 'opportunity', refId: o.id }} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line bg-white text-xl" />
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_320px]">
        <section>
          <h2 className="text-lg font-semibold">About this opportunity</h2>
          <p className="mt-3 whitespace-pre-line text-lg leading-relaxed text-navy-soft">{o.description}</p>
          <Link href={`/people/?u=${poster.username}`} className="mt-8 flex items-center gap-3">
            <Avatar src={poster.avatar} alt="" name={poster.name} size={44} />
            <span className="text-sm">
              <span className="block font-semibold">Posted by {poster.name}</span>
              <span className="text-muted">{poster.headline}</span>
            </span>
          </Link>
        </section>

        <aside>
          {mine ? (
            <Card className="grid gap-3 p-5">
              <p className="font-semibold">
                {applicants.length} applicant{applicants.length === 1 ? '' : 's'}
              </p>
              {applicants.map((a) => {
                const who = person(world, a.applicantId)
                const contract = (world.contracts ?? []).find((c) => c.opportunityId === o.id && c.workerId === a.applicantId)
                return (
                  <div key={a.id} className="rounded-xl bg-ivory p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{who.name}</p>
                      {contract ? (
                        <Link href={`/workroom/?id=${contract.workroomId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-deep hover:underline">
                          <Users className="h-3.5 w-3.5" /> Workroom
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!confirm(`Hire ${who.name} for ${o.title}? You’ll get a shared workroom and a contract for payments.`)) return
                            const r = perform((s, now) => hire(s, a.id, now), `${who.name} is hired!`)
                            if (r.ok) router.push(`/workroom/?id=${r.id}`)
                          }}
                        >
                          Hire
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 text-navy-soft">{a.message}</p>
                    {a.link && (
                      <a href={a.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block truncate text-teal-deep hover:underline">
                        {a.link}
                      </a>
                    )}
                  </div>
                )
              })}
              <button
                onClick={() => {
                  if (confirm('Close and remove this opportunity?')) {
                    perform((s) => deleteOpportunity(s, o.id), 'Opportunity removed.')
                    router.push('/workplace')
                  }
                }}
                className="inline-flex items-center gap-1.5 justify-self-start text-sm text-muted hover:text-coral"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </Card>
          ) : myApp ? (
            <Card className="p-5 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-teal" />
              {(() => {
                const c = (world.contracts ?? []).find((x) => x.opportunityId === o.id && x.workerId === world.accountId)
                return c ? (
                  <>
                    <p className="mt-3 font-semibold">You’re hired!</p>
                    <Link href={`/workroom/?id=${c.workroomId}`} className="mt-3 inline-flex h-10 items-center rounded-full bg-teal px-5 text-sm font-medium text-white">
                      Open workroom
                    </Link>
                  </>
                ) : null
              })()}
              <p className="mt-3 font-semibold">You applied</p>
              <p className="mt-1 text-sm text-muted">
                <TimeAgo ts={myApp.createdAt} /> · track it in{' '}
                <Link href="/activity" className="text-teal-deep hover:underline">
                  Activity
                </Link>
              </p>
            </Card>
          ) : (
            <Card className="p-5">
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  withAuth(() => perform((s, now) => apply(s, o.id, message, link, now), 'Application sent!'), 'Join PLACES FOR US to apply with your profile.')
                }}
              >
                <p className="font-semibold">Apply with your PLACES profile</p>
                <TextArea label="Why you’re a great fit" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} />
                <TextField label="Portfolio or CV link (optional)" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
                <Button type="submit" size="lg" className="w-full !text-base">
                  Send application
                </Button>
              </form>
            </Card>
          )}
          {!mine && (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() =>
                withAuth(() => {
                  const r = perform((s, now) => openThread(s, o.postedById, { kind: 'opportunity', refId: o.id, label: o.title }, now))
                  if (r.ok) router.push(`/messages/?t=${r.id}`)
                }, 'Join PLACES FOR US to message.')
              }
            >
              <MessageCircle className="h-4 w-4" /> Ask a question
            </Button>
          )}
        </aside>
      </div>
    </Shell>
  )
}
