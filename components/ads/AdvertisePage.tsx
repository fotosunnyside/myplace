'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Megaphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Shell } from '@/components/detail/Shell'
import { ImagePicker, Select, TextField } from '@/components/ui/fields'
import { Button, Card, Tag } from '@/components/ui/primitives'
import { cancelAd, checkAd, createAd, type AdInput } from '@/lib/store/actions'
import { perform, useHydrated, useNow, useWorld, withAuth } from '@/lib/store/hooks'
import { formatPrice } from '@/lib/store/selectors'
import { ADS } from '@/lib/config'
import { DISTRICTS } from '@/lib/world/districts'
import type { DistrictId } from '@/lib/types'
import { toast } from '@/lib/ui'
import { cn } from '@/lib/cn'
import { AdCard } from './AdSlot'

const PENDING = 'places:pending-ad'
const names = Object.fromEntries(DISTRICTS.map((d) => [d.id, d.name])) as Record<DistrictId, string>
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function AdvertisePage() {
  const params = useSearchParams()
  const paid = params.get('paid') === '1'
  const place = (params.get('place') as DistrictId | null) ?? 'marketplace'
  const router = useRouter()
  const world = useWorld()
  const ready = useHydrated()
  const now = useNow()
  const handled = useRef(false)
  const [f, setF] = useState({ business: '', headline: '', url: 'https://', district: DISTRICTS.some((d) => d.id === place) ? place : 'marketplace', plan: 'week' as AdInput['plan'] })
  const [image, setImage] = useState<string>()

  // Back from Stripe: book the ad that was paid for.
  useEffect(() => {
    if (!ready || !paid || handled.current) return
    handled.current = true
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING) ?? 'null') as { input: AdInput; at: number } | null
      if (pending && Date.now() - pending.at < 6 * 3_600_000 && world.accountId) {
        perform((s, t) => createAd(s, pending.input, 'stripe', t), 'Payment received — your ad is booked!')
        sessionStorage.removeItem(PENDING)
      }
    } catch {}
    router.replace('/advertise')
  }, [ready, paid, world.accountId, router])

  const mine = world.accountId ? (world.ads ?? []).filter((a) => a.ownerId === world.accountId).sort((a, b) => b.createdAt - a.createdAt) : []
  const input: AdInput = { ...f, image: image ?? '' }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    withAuth(() => {
      try {
        checkAd(input)
      } catch (err) {
        return toast((err as Error).message, 'error')
      }
      const plan = ADS[f.plan]
      if (plan.link) {
        try {
          sessionStorage.setItem(PENDING, JSON.stringify({ input, at: Date.now() }))
        } catch {}
        window.location.href = plan.link
      } else if (confirm(`Stripe isn’t connected for ads yet, so this books a free test ad (normally ${formatPrice(plan.price)}). Continue?`)) {
        perform((s, t) => createAd(s, input, 'test', t), 'Test ad booked.')
      }
    }, 'Join PLACES to advertise your business.')
  }

  return (
    <Shell width="max-w-5xl">
      <section className="rounded-panel bg-gradient-to-br from-[#fdebe6] via-cream to-teal-wash p-8 shadow-soft md:p-12">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-deep">
          <Megaphone className="h-4 w-4" /> Advertise on PLACES
        </p>
        <h1 className="mt-4 max-w-2xl font-serif text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.03]">One gentle banner per Place. Never a wall of ads.</h1>
        <p className="mt-4 max-w-xl text-lg text-navy-soft">Each Place shows a single sponsored mini banner at a time, so your business gets real attention — and the world stays calm.</p>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[1.3fr_1fr]">
        <form onSubmit={submit} className="grid min-w-0 grid-cols-1 content-start gap-5">
          <Card className="grid gap-5 p-6">
            <h2 className="text-lg font-semibold">Your banner</h2>
            <TextField label="Business name" value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} maxLength={40} required />
            <TextField label="Headline" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} maxLength={70} required placeholder="e.g. Handmade candles, poured in small batches" />
            <TextField label="Link" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} required />
            <ImagePicker label="Image" value={image} onChange={setImage} />
            <Select label="Place" options={DISTRICTS.map((d) => d.name)} value={names[f.district]} onChange={(e) => setF({ ...f, district: DISTRICTS.find((d) => d.name === e.target.value)!.id })} />
            <div role="radiogroup" aria-label="Duration" className="grid grid-cols-2 gap-3">
              {(['week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={f.plan === p}
                  onClick={() => setF({ ...f, plan: p })}
                  className={cn('rounded-2xl border p-4 text-left transition', f.plan === p ? 'border-teal bg-teal-wash/60' : 'border-line bg-white hover:border-teal/40')}
                >
                  <span className="block text-2xl font-semibold">{formatPrice(ADS[p].price)}</span>
                  <span className="text-sm text-muted">for 1 {p}</span>
                </button>
              ))}
            </div>
          </Card>
          <Button type="submit" size="lg" className="!text-base">
            Book my banner · {formatPrice(ADS[f.plan].price)}
          </Button>
          <p className="text-xs text-muted">
            {ADS[f.plan].link ? 'Secure checkout with Stripe.' : 'Stripe isn’t connected for ads yet — bookings are test bookings.'} If the {names[f.district]} spot is taken, your banner starts as soon as it frees up.
          </p>
        </form>

        <div className="grid min-w-0 grid-cols-1 content-start gap-5">
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold">Preview</p>
            <AdCard ad={input} preview />
          </Card>
          <Card className="p-5">
            <ul className="grid gap-2.5 text-sm text-navy-soft">
              {['Shown in one select spot in the Place you choose', 'Clearly labelled “Sponsored”', 'Family-friendly, honest ads only', 'No tracking pixels or pop-ups'].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" /> {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {mine.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-3xl">Your ads</h2>
          <ul className="mt-4 grid gap-3">
            {mine.map((a) => {
              const status = now < a.startsAt ? `Starts ${fmtDate(a.startsAt)}` : now < a.endsAt ? `Live until ${fmtDate(a.endsAt)}` : `Ended ${fmtDate(a.endsAt)}`
              return (
                <li key={a.id} className="grid min-w-0 grid-cols-1 gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Tag tone={now < a.endsAt && now >= a.startsAt ? 'teal' : 'neutral'}>{names[a.district]}</Tag>
                    <span className="text-muted" suppressHydrationWarning>
                      {status}
                    </span>
                    {a.via === 'test' && <Tag>Test</Tag>}
                    {now < a.startsAt && (
                      <button onClick={() => confirm('Cancel this booking?') && perform((s) => cancelAd(s, a.id), 'Booking canceled.')} className="text-muted underline hover:text-coral">
                        Cancel
                      </button>
                    )}
                  </div>
                  <AdCard ad={a} />
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </Shell>
  )
}
