'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Check, GraduationCap, Pencil, Plus, Sparkles, Trash2, Users, Wallet } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { PlanOptions } from '@/components/pricing/PlanOptions'
import { Picture } from '@/components/ui/Picture'
import { ButtonLink, Card, Tag } from '@/components/ui/primitives'
import { activePlan, courseSlotsLeft, deleteCourse, hasCreatorPlan, hasPass } from '@/lib/store/actions'
import { perform, useHydrated, useWorld } from '@/lib/store/hooks'
import { coursePrice, formatPrice, me } from '@/lib/store/selectors'
import { COURSE_FEE_LABEL, PLANS } from '@/lib/config'
import { finishPlanCheckout } from '@/lib/plans'
import { openAuth } from '@/lib/ui'
import { Shell } from './Shell'

const money = (cents: number) => formatPrice(cents).replace(/\.00$/, '')

const perks = [
  'Publish courses, guides and memberships in MindPlace',
  'Offer them free, as a one-time purchase, or as a recurring monthly membership',
  'Learners pay you directly through your own Stripe link',
  `A ${COURSE_FEE_LABEL} PLACES platform fee on paid enrollments — 0% with PLACES Pass`,
  'Lessons, progress tracking and completion celebrations built in',
  'Your courses live on your PLACES profile, next to your shop and work',
]

export function TeachPage() {
  const world = useWorld()
  const ready = useHydrated()
  const router = useRouter()
  const subscribed = useSearchParams().get('subscribed') === '1'
  const handled = useRef(false)
  const acc = me(world)
  const publishing = hasCreatorPlan(world)
  const pass = hasPass(world)
  const create = activePlan(world, 'create')
  const slots = courseSlotsLeft(world)

  // Returning from the old creator-plan checkout (its Stripe confirmation page still points here).
  useEffect(() => {
    if (!ready || !subscribed || handled.current) return
    handled.current = true
    finishPlanCheckout(true)
    router.replace('/teach')
  }, [ready, subscribed, router])

  const toEditor = () => router.push('/teach/course/')

  const mine = acc ? world.courses.filter((c) => c.expertId === acc.id) : []
  const learners = mine.reduce((n, c) => n + Object.values(world.enrollments).filter((l) => l.some((e) => e.courseId === c.id)).length, 0)
  const sales = (world.coursePurchases ?? []).filter((p) => mine.some((c) => c.id === p.courseId))
  const revenue = sales.reduce((n, p) => n + p.total, 0)
  const fees = sales.reduce((n, p) => n + (p.fee ?? 0), 0)

  return (
    <Shell width="max-w-5xl">
      <section className="overflow-hidden rounded-panel bg-gradient-to-br from-teal-wash via-cream to-[#fdf2d6] p-8 shadow-soft md:p-12">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-deep">
          <GraduationCap className="h-4 w-4" /> Teach on PLACES
        </p>
        <h1 className="mt-4 max-w-2xl font-serif text-[clamp(2.4rem,5.5vw,4rem)] leading-[1.02]">Share what you know with the world.</h1>
        <p className="mt-4 max-w-xl text-lg text-navy-soft">
          Publish a course or membership in MindPlace for {money(PLANS.create.price)}/month — or with PLACES Pass, at 0% PLACES fees. Offer it free, once, or monthly.
        </p>
      </section>

      {!ready ? (
        <div className="mt-8 h-64 animate-pulse rounded-panel bg-white/50" />
      ) : publishing ? (
        <div className="mt-8 grid gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: BookOpen, label: 'Courses', value: String(mine.length) },
              { icon: Users, label: 'Learners', value: String(learners) },
              { icon: Wallet, label: fees ? `Course sales · ${formatPrice(fees)} PLACES fees` : 'Course sales', value: formatPrice(revenue) },
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
            {slots > 0 && (
              <ButtonLink href="/teach/course/">
                <Plus className="h-4 w-4" /> New course
              </ButtonLink>
            )}
          </div>
          {slots < 1 && mine.length > 0 && (
            <div>
              <p className="mb-3 text-sm text-navy-soft">Publishing another course or membership? Add it to Create in MindPlace, or publish as many as you like with PLACES Pass.</p>
              <PlanOptions context="course" onPass={toEditor} />
            </div>
          )}
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
                        {c.lessons.length} lesson{c.lessons.length === 1 ? '' : 's'} · {coursePrice(c)}
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
                {pass ? PLANS.pass.name : `${PLANS.create.name}${create && create.quantity > 1 ? ` × ${create.quantity}` : ''}`} <Tag tone="teal">Active</Tag>
                {(pass ? activePlan(world, 'pass') : create)?.via === 'test' && <Tag>Test mode</Tag>}
              </p>
              <p className="mt-1 text-sm text-muted">
                {pass
                  ? `0% PLACES fee on course and membership sales.`
                  : `${money(PLANS.create.price)}/month per course or membership · ${COURSE_FEE_LABEL} PLACES fee on paid enrollments.`}
              </p>
            </div>
            <ButtonLink href="/pricing" variant="outline" size="sm">
              Manage plans
            </ButtonLink>
          </Card>
        </div>
      ) : (
        <div className="mt-8 grid gap-6">
          <Card className="p-7">
            <h2 className="font-serif text-2xl">Everything you need to teach</h2>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {perks.map((p) => (
                <li key={p} className="flex gap-3 text-navy-soft">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal" /> {p}
                </li>
              ))}
            </ul>
          </Card>
          {(activePlan(world, 'create') === undefined && acc?.plans?.create?.status === 'canceled') || acc?.creatorPlan?.status === 'canceled' ? (
            <p className="rounded-xl bg-sun/25 px-4 py-3 text-sm">Your plan is paused, so your courses are hidden from MindPlace. Choose a plan to bring them back.</p>
          ) : null}
          <div>
            <h2 className="mb-4 font-serif text-2xl">Create a course or membership</h2>
            <PlanOptions context="course" onPass={toEditor} />
          </div>
          {!acc && (
            <button onClick={() => openAuth({ mode: 'signin' })} className="text-sm text-teal-deep hover:underline">
              Already a member? Sign in
            </button>
          )}
        </div>
      )}
    </Shell>
  )
}
