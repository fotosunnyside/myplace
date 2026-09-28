'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Check, CreditCard, GraduationCap, Pencil, Plus, Sparkles, Trash2, Users, Wallet } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Picture } from '@/components/ui/Picture'
import { Button, ButtonLink, Card, Tag } from '@/components/ui/primitives'
import { cancelCreator, deleteCourse, subscribeCreator } from '@/lib/store/actions'
import { perform, useHydrated, useNow, useWorld, withAuth } from '@/lib/store/hooks'
import { formatPrice, me } from '@/lib/store/selectors'
import { CREATOR_PLAN } from '@/lib/config'
import { openAuth } from '@/lib/ui'
import { Shell } from './Shell'

const PENDING = 'places:pending-creator-plan'

const perks = [
  'Publish unlimited courses and guides',
  'Offer them free, or sell them at your own price',
  'Keep 100% of course sales — learners pay you directly through Stripe',
  'Lessons, progress tracking and completion celebrations built in',
  'Your courses live on your PLACES profile, next to your shop and work',
]

export function TeachPage() {
  const world = useWorld()
  const ready = useHydrated()
  const now = useNow()
  const router = useRouter()
  const subscribed = useSearchParams().get('subscribed') === '1'
  const handled = useRef(false)
  const acc = me(world)
  const plan = acc?.creatorPlan
  const active = plan?.status === 'active'

  // Returning from the Stripe subscription checkout.
  useEffect(() => {
    if (!ready || !subscribed || handled.current) return
    handled.current = true
    try {
      if (sessionStorage.getItem(PENDING) && world.accountId) {
        perform((s, t) => subscribeCreator(s, 'stripe', t), 'Welcome, creator! Your plan is active.')
        sessionStorage.removeItem(PENDING)
      }
    } catch {}
    router.replace('/teach')
  }, [ready, subscribed, world.accountId, router])

  const start = () =>
    withAuth(() => {
      const account = me(world) ?? null
      if (CREATOR_PLAN.link) {
        try {
          sessionStorage.setItem(PENDING, String(Date.now()))
        } catch {}
        const email = account?.email ? `?prefilled_email=${encodeURIComponent(account.email)}` : ''
        window.location.href = CREATOR_PLAN.link + email
      } else if (confirm('Stripe isn’t connected for the creator plan yet, so this starts a free test plan. Continue?')) {
        perform((s, t) => subscribeCreator(s, 'test', t), 'Test creator plan started.')
      }
    }, 'Join PLACES to start teaching.')

  const mine = acc ? world.courses.filter((c) => c.expertId === acc.id) : []
  const learners = mine.reduce((n, c) => n + Object.values(world.enrollments).filter((l) => l.some((e) => e.courseId === c.id)).length, 0)
  const sales = (world.coursePurchases ?? []).filter((p) => mine.some((c) => c.id === p.courseId))
  const revenue = sales.reduce((n, p) => n + p.total, 0)

  return (
    <Shell width="max-w-5xl">
      <section className="overflow-hidden rounded-panel bg-gradient-to-br from-teal-wash via-cream to-[#fdf2d6] p-8 shadow-soft md:p-12">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-deep">
          <GraduationCap className="h-4 w-4" /> Teach on PLACES
        </p>
        <h1 className="mt-4 max-w-2xl font-serif text-[clamp(2.4rem,5.5vw,4rem)] leading-[1.02]">Share what you know with the world.</h1>
        <p className="mt-4 max-w-xl text-lg text-navy-soft">
          Host your courses in MindPlace for {formatPrice(CREATOR_PLAN.price)} a month. Offer them free or sell them — you keep every dollar.
        </p>
      </section>

      {!ready ? (
        <div className="mt-8 h-64 animate-pulse rounded-panel bg-white/50" />
      ) : active ? (
        <div className="mt-8 grid gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: BookOpen, label: 'Courses', value: String(mine.length) },
              { icon: Users, label: 'Learners', value: String(learners) },
              { icon: Wallet, label: 'Course sales', value: formatPrice(revenue) },
            ].map(({ icon: Icon, label, value }) => (
              <Card key={label} className="flex items-center gap-4 p-5">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-wash text-teal-deep">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-2xl font-semibold">{value}</span>
                  <span className="text-sm text-muted">{label}</span>
                </span>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-3xl">Your courses</h2>
            <ButtonLink href="/teach/course/">
              <Plus className="h-4 w-4" /> New course
            </ButtonLink>
          </div>
          {mine.length ? (
            <ul className="grid gap-3">
              {mine.map((c) => (
                <li key={c.id}>
                  <Card className="flex items-center gap-4 p-3">
                    <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-teal-wash">
                      <Picture src={c.image} alt="" fill sizes="96px" className="object-cover" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/mindplace/course/?id=${c.id}`} className="block truncate font-semibold hover:underline">
                        {c.title}
                      </Link>
                      <p className="text-sm text-muted">
                        {c.lessons.length} lesson{c.lessons.length === 1 ? '' : 's'} · {c.price ? formatPrice(c.price) : 'Free'}
                        {c.price && !c.stripeLink ? ' · add a Stripe link to get paid' : ''}
                      </p>
                    </div>
                    <ButtonLink href={`/teach/course/?id=${c.id}`} size="sm" variant="outline" aria-label={`Edit ${c.title}`}>
                      <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Edit</span>
                    </ButtonLink>
                    <button
                      onClick={() => confirm(`Delete “${c.title}”? Learners will lose access.`) && perform((s) => deleteCourse(s, c.id), 'Course deleted.')}
                      aria-label={`Delete ${c.title}`}
                      className="rounded-full p-2 text-muted hover:bg-navy/5 hover:text-coral"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="p-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-teal" />
              <p className="mt-3 font-semibold">Your first course is waiting.</p>
              <p className="mt-1 text-sm text-muted">Start with a title, a cover and a few short lessons. You can edit it anytime.</p>
              <ButtonLink href="/teach/course/" className="mt-5">
                <Plus className="h-4 w-4" /> Create a course
              </ButtonLink>
            </Card>
          )}

          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                Creator plan <Tag tone="teal">Active</Tag> {plan?.via === 'test' && <Tag>Test mode</Tag>}
              </p>
              <p className="mt-1 text-sm text-muted" suppressHydrationWarning>
                {formatPrice(CREATOR_PLAN.price)}/month · renews {new Date(plan!.renewsAt < now ? now : plan!.renewsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </p>
            </div>
            {plan?.via === 'stripe' && CREATOR_PLAN.portal ? (
              <ButtonLink href={CREATOR_PLAN.portal} variant="outline" size="sm" target="_blank">
                <CreditCard className="h-4 w-4" /> Manage billing
              </ButtonLink>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => confirm('Cancel your creator plan? Your courses will be hidden from MindPlace until you restart it.') && perform(cancelCreator, 'Creator plan canceled.')}
              >
                Cancel plan
              </Button>
            )}
          </Card>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <Card className="p-7">
            <h2 className="font-serif text-2xl">Everything you need to teach</h2>
            <ul className="mt-5 grid gap-3">
              {perks.map((p) => (
                <li key={p} className="flex gap-3 text-navy-soft">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal" /> {p}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col p-7 ring-2 ring-teal/30">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-deep">Creator plan</p>
            <p className="mt-3">
              <span className="font-serif text-6xl">{formatPrice(CREATOR_PLAN.price)}</span>
              <span className="text-muted"> / month</span>
            </p>
            <p className="mt-2 text-sm text-muted">Cancel anytime. No commission on your course sales.</p>
            {plan?.status === 'canceled' && <p className="mt-4 rounded-xl bg-sun/25 px-3 py-2 text-sm">Your plan is paused, so your courses are hidden from MindPlace. Restart to bring them back.</p>}
            <Button size="lg" className="mt-6 w-full !text-base" onClick={start}>
              {plan?.status === 'canceled' ? 'Restart my plan' : 'Start teaching'}
            </Button>
            {!acc && (
              <button onClick={() => openAuth({ mode: 'signin' })} className="mt-3 text-sm text-teal-deep hover:underline">
                Already a member? Sign in
              </button>
            )}
            <p className="mt-4 text-xs text-muted">{CREATOR_PLAN.link ? 'Secure checkout with Stripe.' : 'Stripe checkout isn’t connected yet — plans start in test mode.'}</p>
          </Card>
        </div>
      )}
    </Shell>
  )
}
