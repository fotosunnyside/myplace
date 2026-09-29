'use client'

import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { COURSE_FEE_LABEL, JOB_POST, PLANS } from '@/lib/config'
import { choosePlan } from '@/lib/plans'
import { formatPrice } from '@/lib/store/selectors'
import { cn } from '@/lib/cn'

export type PlanContext = 'course' | 'space' | 'job'

const money = (cents: number) => formatPrice(cents).replace(/\.00$/, '')
const PASS = `${PLANS.pass.name} — ${money(PLANS.pass.price)}/month`

const SINGLE: Record<PlanContext, { title: string; lines: string[]; cta: string }> = {
  course: {
    title: PLANS.create.name,
    lines: [`${money(PLANS.create.price)}/month per course or membership`, `+ ${COURSE_FEE_LABEL} platform fee on paid enrollments`],
    cta: `Publish for ${money(PLANS.create.price)}/month`,
  },
  space: {
    title: `Create Virtual Places — ${money(PLANS.host.price)}/month`,
    lines: ['Your own meetings, communities, classes, study groups, networking and gatherings — with a link anyone in PLACES can join.'],
    cta: `Create Virtual Places — ${money(PLANS.host.price)}/month`,
  },
  job: {
    title: `Post this opportunity — ${money(JOB_POST.price)}`,
    lines: ['A one-time posting fee for this job or opportunity.'],
    cta: `Post for ${money(JOB_POST.price)}`,
  },
}

const PASS_COPY: Record<PlanContext, { title: string; body: string }> = {
  course: {
    title: PASS,
    body: 'Publish courses and memberships with 0% PLACES platform fees, create Virtual Places, post WorkPlace opportunities, and unlock creator privileges across PLACES.',
  },
  space: {
    title: `Included with ${PASS}`,
    body: 'Create your own Virtual Places — plus more across PLACES FOR US: publish courses and memberships with 0% PLACES platform fees, and post WorkPlace opportunities.',
  },
  job: { title: 'Included with PLACES Pass', body: `Post opportunities without the per-post charge — plus course publishing and hosting, for ${money(PLANS.pass.price)}/month.` },
}

/**
 * The choice shown at the moment someone tries a paid action: the single option, or PLACES Pass.
 * The Pass is the visually preferred option, but the single option is always one click away.
 */
export function PlanOptions({
  context,
  onSingle,
  onPass,
  className,
}: {
  context: PlanContext
  /** For `job`, the caller runs the $3 posting flow. Defaults to starting the matching plan. */
  onSingle?: () => void
  /** Runs once the Pass is active (test mode) — e.g. carry on to the editor. */
  onPass?: () => void
  className?: string
}) {
  const single = SINGLE[context]
  const pass = PASS_COPY[context]
  const startSingle = onSingle ?? (() => choosePlan(context === 'course' ? 'create' : 'host', onPass))

  return (
    <div className={cn('grid gap-x-3 gap-y-5 pt-3 md:grid-cols-2', className)}>
      <div className="flex flex-col rounded-card border border-line bg-white p-5">
        <p className="font-serif text-2xl leading-tight">{single.title}</p>
        <ul className="mt-2 grid gap-1 text-sm text-navy-soft">
          {single.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <div className="mt-auto pt-5">
          <Button variant="outline" onClick={startSingle} className="w-full">
            {single.cta}
          </Button>
        </div>
      </div>
      <div className="relative flex flex-col rounded-card bg-navy p-5 text-white shadow-lift ring-2 ring-teal">
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white">
          <Sparkles className="h-3 w-3" /> One Pass. Every Place.
        </span>
        <p className="font-serif text-2xl leading-tight">{pass.title}</p>
        <p className="mt-2 text-sm text-white/80">{pass.body}</p>
        <ul className="mt-3 grid gap-1 text-sm text-white/90">
          {['0% PLACES course & membership fee', 'Create Virtual Places', 'Post WorkPlace opportunities'].map((l) => (
            <li key={l} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-aqua" /> {l}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-5">
          <Button onClick={() => choosePlan('pass', onPass)} className="w-full !bg-white !text-navy hover:!bg-cream">
            Get PLACES Pass
          </Button>
        </div>
      </div>
      <p className="text-center text-xs text-muted md:col-span-2">
        Payment processing fees are separate from PLACES fees.{' '}
        <Link href="/pricing" className="text-teal-deep hover:underline">
          Compare plans
        </Link>
      </p>
    </div>
  )
}
