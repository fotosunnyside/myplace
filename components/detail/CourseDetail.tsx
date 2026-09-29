'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown, Clock, CreditCard, Lock, Pencil, Radio, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SaveButton } from '@/components/cards'
import { Picture } from '@/components/ui/Picture'
import { Avatar, Button, ButtonLink, Card } from '@/components/ui/primitives'
import { canAccessCourse, enroll, purchaseCourse, toggleLesson } from '@/lib/store/actions'
import { perform, useHydrated, useNow, useWorld, withAuth } from '@/lib/store/hooks'
import { count, coursePrice, enrollmentsOf, formatCount, formatPrice, person, timeUntil } from '@/lib/store/selectors'
import { cn } from '@/lib/cn'
import { NotFoundHere, Shell } from './Shell'

const PENDING = 'places:pending-course'

export function CourseDetail() {
  const params = useSearchParams()
  const id = params.get('id')
  const paid = params.get('paid') === '1'
  const router = useRouter()
  const world = useWorld()
  const ready = useHydrated()
  const now = useNow()
  const handled = useRef(false)
  const [open, setOpen] = useState<string | null>(null)
  const c = world.courses.find((x) => x.id === id)

  // Returning from the creator's Stripe checkout: record the purchase this device started.
  useEffect(() => {
    if (!ready || !paid || !c || handled.current) return
    handled.current = true
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING) ?? 'null') as { courseId: string; at: number } | null
      if (pending?.courseId === c.id && Date.now() - pending.at < 6 * 3_600_000 && world.accountId) {
        perform((s, t) => purchaseCourse(s, c.id, 'stripe', t), 'Payment complete — enjoy your course!')
        sessionStorage.removeItem(PENDING)
      }
    } catch {}
    router.replace(`/mindplace/course/?id=${c.id}`)
  }, [ready, paid, c, world.accountId, router])

  if (!c)
    return (
      <Shell back={{ href: '/mindplace', label: 'MindPlace' }}>
        <NotFoundHere what="course" href="/mindplace" label="Back to MindPlace" />
      </Shell>
    )

  const expert = person(world, c.expertId)
  const e = world.accountId ? enrollmentsOf(world, world.accountId).find((x) => x.courseId === c.id) : undefined
  const done = e?.completed.length ?? 0
  const pct = Math.round((done / c.lessons.length) * 100)
  const minutes = c.lessons.reduce((n, l) => n + l.minutes, 0)
  const access = canAccessCourse(world, c.id)
  const mine = c.expertId === world.accountId
  const buy = () =>
    withAuth(() => {
      if (c.stripeLink) {
        try {
          sessionStorage.setItem(PENDING, JSON.stringify({ courseId: c.id, at: Date.now() }))
        } catch {}
        window.location.href = c.stripeLink
      } else if (confirm(`Get ${c.title} as a test purchase? No payment is taken — the creator hasn’t connected Stripe yet.`)) {
        perform((s, t) => purchaseCourse(s, c.id, 'test', t), 'Test purchase complete — the course is unlocked.')
      }
    }, 'Join PLACES to get this course.')
  const members = count(c.baseMembers, Object.values(world.enrollments).filter((l) => l.some((x) => x.courseId === c.id)).length)

  return (
    <Shell back={{ href: '/mindplace', label: 'MindPlace' }}>
      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-start">
        <div className="relative aspect-[4/3] overflow-hidden rounded-panel shadow-soft">
          <Picture src={c.image} alt="" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          {c.kind === 'live' && (
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-coral px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              <Radio className="h-3.5 w-3.5" /> Live
            </span>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-deep">
            MindPlace · {c.kind === 'guide' ? 'Guide' : c.kind === 'live' ? 'Live workshop' : 'Course'}
          </p>
          <h1 className="mt-2 font-serif text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.02]">{c.title}</h1>
          <p className="mt-1 text-lg text-navy-soft">{c.subtitle}</p>
          <p className="mt-3 text-2xl font-semibold">{coursePrice(c)}</p>
          <p className="mt-4 leading-relaxed text-navy-soft">{c.description}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-teal" /> {formatCount(members)} members
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-teal" /> {c.lessons.length} lessons · {minutes} min
            </span>
            {c.startsAt && <span suppressHydrationWarning>{timeUntil(c.startsAt, now)}</span>}
          </div>
          <Link href={`/people/?u=${expert.username}`} className="mt-5 flex items-center gap-3">
            <Avatar src={expert.avatar} alt="" name={expert.name} size={40} />
            <span className="text-sm">
              <span className="block font-semibold">{expert.name}</span>
              <span className="text-muted">{expert.headline}</span>
            </span>
          </Link>
          <div className="mt-6 flex items-center gap-3">
            {mine ? (
              <ButtonLink href={`/teach/course/?id=${c.id}`} size="lg" variant="outline" className="flex-1 !text-base">
                <Pencil className="h-4 w-4" /> Edit your course
              </ButtonLink>
            ) : !access ? (
              <Button size="lg" className="flex-1 !text-base" onClick={buy}>
                <CreditCard className="h-5 w-5" /> {c.billing === 'monthly'
                  ? `${c.stripeLink ? 'Join membership' : 'Join membership (test)'} · ${coursePrice(c)}`
                  : c.stripeLink
                    ? `Buy course · ${formatPrice(c.price!)}`
                    : `Get course · ${formatPrice(c.price!)} (test)`}
              </Button>
            ) : e ? (
              <div className="flex-1">
                <div className="h-2.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-teal transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted">{done === c.lessons.length ? 'Completed 🎉' : `${done} of ${c.lessons.length} lessons complete`}</p>
              </div>
            ) : (
              <Button size="lg" className="flex-1 !text-base" onClick={() => withAuth(() => perform((s, t) => enroll(s, c.id, t), `You joined ${c.title}.`), 'Join PLACES to start learning.')}>
                {c.kind === 'live' ? 'Reserve my spot' : c.price ? 'Start learning' : 'Start learning — free'}
              </Button>
            )}
            <SaveButton refItem={{ kind: 'course', refId: c.id }} label className="h-12 rounded-full border border-line bg-white px-5 text-sm font-medium" />
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Lessons</h2>
        <ol className="mt-5 grid gap-3">
          {c.lessons.map((l, i) => {
            const complete = !!e?.completed.includes(l.id)
            const locked = !access && i > 0
            const expanded = open === l.id && !locked
            return (
              <li key={l.id}>
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    {locked ? (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ivory text-muted" aria-label="Locked">
                        <Lock className="h-4 w-4" />
                      </span>
                    ) : (
                    <button
                      onClick={() => withAuth(() => perform((s, t) => toggleLesson(s, c.id, l.id, t)), 'Join PLACES to track your progress.')}
                      aria-pressed={complete}
                      aria-label={complete ? `Mark “${l.title}” as not done` : `Mark “${l.title}” as done`}
                      className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition', complete ? 'border-teal bg-teal text-white' : 'border-line text-transparent hover:border-teal/50')}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </button>
                    )}
                    <button onClick={() => (locked ? buy() : setOpen(expanded ? null : l.id))} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                      <span>
                        <span className="text-xs text-muted">
                          Lesson {i + 1} · {l.minutes} min{!access && i === 0 ? ' · Free preview' : ''}
                        </span>
                        <span className={cn('block font-semibold', complete && 'text-muted line-through decoration-teal/40')}>{l.title}</span>
                      </span>
                      <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition-transform', expanded && 'rotate-180')} />
                    </button>
                  </div>
                  {expanded && <p className="border-t border-line/70 bg-ivory/60 px-5 py-4 leading-relaxed text-navy-soft md:pl-[4.25rem]">{l.body}</p>}
                </Card>
              </li>
            )
          })}
        </ol>
      </section>
    </Shell>
  )
}
