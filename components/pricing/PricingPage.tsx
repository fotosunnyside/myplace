'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, DoorOpen, GraduationCap, Megaphone, Sparkles, Store, Users } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Shell } from '@/components/detail/Shell'
import { Button, ButtonLink, Card, Tag } from '@/components/ui/primitives'
import { ADS, COURSE_FEE_LABEL, JOB_POST, PLANS, SALES_FEE_LABEL, STRIPE_PORTAL } from '@/lib/config'
import { choosePlan, finishPlanCheckout } from '@/lib/plans'
import { activePlan, cancelPlan } from '@/lib/store/actions'
import { perform, useHydrated, useNow, useWorld } from '@/lib/store/hooks'
import { formatPrice, me } from '@/lib/store/selectors'
import type { PlanKind } from '@/lib/types'
import { openAuth } from '@/lib/ui'
import { cn } from '@/lib/cn'
import { PLACES_HREF } from '@/lib/spaces/rooms'

const money = (cents: number) => formatPrice(cents).replace(/\.00$/, '')

type Cell = string | { text: string; strong?: boolean }
const INCLUDED = 'Included'

/** Free vs PLACES Pass — the one comparison the pricing page leads with. */
const ROWS: [string, Cell, Cell][] = [
  ['Monthly price', { text: '$0', strong: true }, { text: `${money(PLANS.pass.price)}/month`, strong: true }],
  ['Create a profile', INCLUDED, INCLUDED],
  ['Explore all Places', INCLUDED, INCLUDED],
  ['Social posting & connections', INCLUDED, INCLUDED],
  ['Attend Town Hall', INCLUDED, INCLUDED],
  ['Attend Accountability Department', INCLUDED, INCLUDED],
  ['Join virtual rooms', INCLUDED, INCLUDED],
  ['Buy courses & products', INCLUDED, INCLUDED],
  ['Local MarketPlace transactions', 'Free', 'Free'],
  ['Publish a course or membership', `${money(PLANS.create.price)}/mo each`, { text: INCLUDED, strong: true }],
  ['Course & membership platform fee', COURSE_FEE_LABEL, { text: '0%', strong: true }],
  ['Create Virtual Places', `${money(PLANS.host.price)}/mo`, { text: INCLUDED, strong: true }],
  ['Post a WorkPlace opportunity', `${money(JOB_POST.price)}/post`, { text: INCLUDED, strong: true }],
  ['Shipped MarketPlace transaction', SALES_FEE_LABEL, SALES_FEE_LABEL],
  ['Sponsored placements', `${money(ADS.week.price)}/week`, `${money(ADS.week.price)}/week`],
]

const cell = (c: Cell) => (typeof c === 'string' ? { text: c, strong: false } : { strong: false, ...c })

export function PricingPage() {
  const world = useWorld()
  const ready = useHydrated()
  const router = useRouter()
  const started = useSearchParams().get('plan') === 'started'
  const handled = useRef(false)
  const account = me(world)
  const pass = activePlan(world, 'pass')

  // Back from a Stripe plan checkout.
  useEffect(() => {
    if (!ready || !started || handled.current || !world.accountId) return
    handled.current = true
    const back = finishPlanCheckout()
    router.replace(back && back !== '/pricing' && back !== '/pricing/' ? back : '/pricing')
  }, [ready, started, world.accountId, router])

  return (
    <Shell width="max-w-5xl">
      <section className="text-center">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.32em] text-teal-deep">Pricing</p>
        <h1 className="mx-auto mt-3 max-w-3xl font-serif text-[clamp(2.4rem,6vw,4rem)] leading-[1.02]">Free to explore. Free to belong. Pay when you want to build.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-navy-soft">
          PLACES is free to join, explore, connect and take part in. You pay only when you create, host, sell professionally, hire or promote.
        </p>
      </section>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">PLACES Free</p>
          <p className="mt-2 font-serif text-6xl">$0</p>
          <p className="mt-2 text-navy-soft">Everything you need to belong: your profile, all four Places, Town Hall and the Accountability Department.</p>
          <div className="mt-auto pt-6">
            {account ? (
              <p className="flex items-center gap-2 text-sm font-medium text-teal-deep">
                <Check className="h-4 w-4" /> You’re a member
              </p>
            ) : (
              <Button variant="outline" onClick={() => openAuth({ mode: 'join' })} className="w-full">
                Join free
              </Button>
            )}
          </div>
        </Card>
        <div className="relative flex flex-col rounded-card bg-navy p-6 text-white shadow-lift ring-2 ring-teal md:p-8">
          <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-teal px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em]">
            <Sparkles className="h-3.5 w-3.5" /> PLACES Pass
          </span>
          <p className="font-serif text-4xl leading-tight">One Pass. Every Place.</p>
          <p className="mt-1 font-serif text-5xl">
            {money(PLANS.pass.price)}
            <span className="text-2xl text-white/70">/month</span>
          </p>
          <p className="mt-3 text-white/85">Create, teach, host and build across PLACES with one simple membership. Creator and professional privileges across PLACES.</p>
          <div className="mt-auto pt-6">
            {pass ? (
              <p className="flex items-center gap-2 text-sm font-medium text-aqua">
                <Check className="h-4 w-4" /> Your PLACES Pass is active
              </p>
            ) : (
              <Button onClick={() => choosePlan('pass')} className="w-full !bg-white !text-navy hover:!bg-cream">
                Get PLACES Pass
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-card border border-line/80 bg-white/80 shadow-soft">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">PLACES Free compared with PLACES Pass</caption>
          <thead>
            <tr className="border-b border-line/80 bg-ivory/60">
              <th scope="col" className="px-4 py-3 font-medium text-muted md:px-6">
                <span className="sr-only">Feature</span>
              </th>
              <th scope="col" className="px-3 py-3 font-semibold md:px-6">
                PLACES Free
              </th>
              <th scope="col" className="px-3 py-3 font-semibold text-teal-deep md:px-6">
                PLACES Pass
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, free, withPass]) => {
              const f = cell(free)
              const p = cell(withPass)
              return (
                <tr key={label} className="border-b border-line/50 last:border-0">
                  <th scope="row" className="px-4 py-3 font-normal text-navy md:px-6">
                    {label}
                  </th>
                  <td className={cn('px-3 py-3 md:px-6', f.strong ? 'font-semibold text-navy' : 'text-navy-soft')}>{f.text}</td>
                  <td className={cn('bg-teal-wash/30 px-3 py-3 md:px-6', p.strong ? 'font-semibold text-teal-deep' : 'text-navy-soft')}>{p.text}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Advertising and MarketPlace shipped-sale fees stay separate from the Pass. Payment processing fees (for example Stripe’s) are separate from PLACES fees and still apply.
      </p>

      <section className="mt-14" aria-labelledby="pay-as-you-go">
        <h2 id="pay-as-you-go" className="font-serif text-[2rem] leading-tight">
          Prefer to pay only for what you use?
        </h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Option
            icon={<GraduationCap className="h-5 w-5" />}
            title={`Create in MindPlace — ${money(PLANS.create.price)}/month`}
            text={`Publish a course or membership. Choose free, one-time, or recurring enrollment pricing. A ${COURSE_FEE_LABEL} PLACES platform fee applies to paid transactions.`}
            action={<Button variant="soft" size="sm" onClick={() => choosePlan('create')}>Publish for {money(PLANS.create.price)}/month</Button>}
          />
          <Option
            icon={<DoorOpen className="h-5 w-5" />}
            title={`Create Virtual Places — ${money(PLANS.host.price)}/month`}
            text="Your own Virtual Places: meetings, communities, classes, networking or gatherings, with a link to share."
            action={<Button variant="soft" size="sm" onClick={() => choosePlan('host')}>Create a Virtual Place</Button>}
          />
          <Option
            icon={<Users className="h-5 w-5" />}
            title={`Post in WorkPlace — ${money(JOB_POST.price)}/post`}
            text="Publish a job or opportunity. Browsing and applying are always free."
            action={<ButtonLink href="/workplace" variant="soft" size="sm">Post an opportunity</ButtonLink>}
          />
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-coral/15 text-coral">
            <Store className="h-5 w-5" />
          </span>
          <h2 className="mt-3 font-serif text-2xl">MarketPlace</h2>
          <p className="mt-1 text-navy-soft">
            Local pickup and person-to-person sales are free. Orders placed through PLACES and shipped carry a {SALES_FEE_LABEL} platform fee — with or without the Pass.
          </p>
        </Card>
        <Card className="p-6">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-wash text-teal-deep">
            <Megaphone className="h-5 w-5" />
          </span>
          <h2 className="mt-3 font-serif text-2xl">Get Seen in PLACES</h2>
          <p className="mt-1 text-navy-soft">Sponsored placements start at {money(ADS.week.price)}/week, in YourPlace, MindPlace, MarketPlace or WorkPlace.</p>
          <ButtonLink href="/advertise" variant="outline" size="sm" className="mt-4">
            Promote in PLACES
          </ButtonLink>
        </Card>
      </section>

      {ready && account && <YourPlans />}
    </Shell>
  )
}

function Option({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action: ReactNode }) {
  return (
    <Card className="flex flex-col p-5">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-wash text-teal-deep">{icon}</span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-navy-soft">{text}</p>
      <div className="mt-auto pt-4">{action}</div>
    </Card>
  )
}

const CANCEL_NOTE: Record<PlanKind, string> = {
  pass: 'Cancel PLACES Pass? Courses you publish will need Create in MindPlace to stay listed, and your Virtual Places close unless you keep Create Virtual Places.',
  host: 'Cancel Create Virtual Places? Your Virtual Places close until you start it again.',
  create: 'Cancel Create in MindPlace? Your courses and memberships will be hidden from MindPlace until you restart it.',
}

/** The member's own plans: what's active, and a way out. */
function YourPlans() {
  const world = useWorld()
  const now = useNow()
  const plans = (['pass', 'create', 'host'] as PlanKind[]).map((k) => ({ k, plan: activePlan(world, k) })).filter((x) => x.plan)
  if (!plans.length) return null
  return (
    <section className="mt-14" aria-labelledby="your-plans">
      <h2 id="your-plans" className="font-serif text-[2rem] leading-tight">
        Your plans
      </h2>
      <div className="mt-4 grid gap-3">
        {plans.map(({ k, plan }) => (
          <Card key={k} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">
                {PLANS[k].name}
                {k === 'create' && plan!.quantity > 1 ? ` × ${plan!.quantity}` : ''}
              </p>
              <p className="text-sm text-muted" suppressHydrationWarning>
                {money(PLANS[k].price * (k === 'create' ? plan!.quantity : 1))}/month · renews{' '}
                {new Date(Math.max(plan!.renewsAt, now)).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tag tone={plan!.via === 'stripe' ? 'teal' : 'neutral'}>{plan!.via === 'stripe' ? 'Stripe' : 'Test plan'}</Tag>
              {plan!.via === 'stripe' && STRIPE_PORTAL ? (
                <ButtonLink href={STRIPE_PORTAL} variant="outline" size="sm" target="_blank">
                  Manage billing
                </ButtonLink>
              ) : (
                <Button variant="outline" size="sm" onClick={() => confirm(CANCEL_NOTE[k]) && perform((s) => cancelPlan(s, k), `${PLANS[k].name} canceled.`)}>
                  Cancel
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        <Link href="/teach" className="text-teal-deep hover:underline">
          Your courses
        </Link>{' '}
        ·{' '}
        <Link href={PLACES_HREF} className="text-teal-deep hover:underline">
          Your Virtual Places
        </Link>
      </p>
    </section>
  )
}
