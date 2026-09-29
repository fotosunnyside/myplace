'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bell, Download, LogOut, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DiscussionRow, LearningCard, OpportunityRow, PostCard, ProductCard, ShopCard, TimeAgo } from '@/components/cards'
import { ProfileView } from '@/components/profile/ProfileView'
import { SearchField } from '@/components/search/SearchField'
import { ChipPicker, ImagePicker, TextArea, TextField } from '@/components/ui/fields'
import { Avatar, Button, ButtonLink, Card, SectionHeader, Tag } from '@/components/ui/primitives'
import { activePlan, deleteAccount, markAllNotificationsRead, signOut, updateProfile } from '@/lib/store/actions'
import { PLANS } from '@/lib/config'
import { leaveRoomAndSignOut } from '@/lib/spaces/signout'
import { perform, useHydrated, useWorld } from '@/lib/store/hooks'
import { enrollmentsOf, formatPrice, me, person, personByUsername, search } from '@/lib/store/selectors'
import { getWorldMode, resetDevice } from '@/lib/store/store'
import { deleteCloudAccount } from '@/lib/store/account'
import type { Account } from '@/lib/types'
import { openAuth, toast } from '@/lib/ui'
import { cn } from '@/lib/cn'
import { NotFoundHere, Shell } from './Shell'

function SignInPrompt({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-panel bg-white/70 px-6 py-16 text-center">
      <h1 className="font-serif text-3xl">{title}</h1>
      <p className="mt-2 text-muted">{text}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={() => openAuth({ mode: 'join' })}>Join PLACES</Button>
        <Button variant="outline" onClick={() => openAuth({ mode: 'signin' })}>
          Sign in
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* People                                                               */
/* ------------------------------------------------------------------ */

export function PeoplePage() {
  const u = useSearchParams().get('u') ?? ''
  const world = useWorld()
  const router = useRouter()
  const p = personByUsername(world, u)
  const own = !!p && p.id === world.accountId
  useEffect(() => {
    if (own) router.replace('/yourplace')
  }, [own, router])

  return (
    <Shell width="max-w-6xl" className="@container">
      {p ? <ProfileView key={p.id} p={p} own={false} /> : <NotFoundHere what="person" href="/explore" label="Explore PLACES" />}
    </Shell>
  )
}

/* ------------------------------------------------------------------ */
/* Notifications                                                        */
/* ------------------------------------------------------------------ */

export function NotificationsPage() {
  const world = useWorld()
  const ready = useHydrated()
  const list = world.accountId ? (world.notifications[world.accountId] ?? []) : []
  const unread = list.some((n) => !n.read)
  useEffect(() => {
    if (!unread) return
    const t = setTimeout(() => perform(markAllNotificationsRead), 1500)
    return () => clearTimeout(t)
  }, [unread])

  return (
    <Shell width="max-w-2xl">
      {ready && !world.accountId ? (
        <SignInPrompt title="Notifications" text="Join PLACES to hear about replies, orders and applications." />
      ) : (
        <>
          <h1 className="font-serif text-4xl">Notifications</h1>
          <ul className="mt-6 grid gap-2">
            {list.length === 0 && <li className="rounded-2xl bg-white/60 py-12 text-center text-muted">You’re all caught up.</li>}
            {list.map((n) => (
              <li key={n.id}>
                <Link href={n.href} className={cn('flex items-center gap-4 rounded-2xl border border-line/70 bg-white/80 p-4 transition hover:bg-white', !n.read && 'border-teal/30 bg-teal-wash/40')}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-wash text-teal-deep">
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{n.text}</span>
                    <TimeAgo ts={n.createdAt} className="text-xs text-muted" />
                  </span>
                  {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-teal" aria-label="New" />}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
  )
}

/* ------------------------------------------------------------------ */
/* Search                                                               */
/* ------------------------------------------------------------------ */

export function SearchPage() {
  const q = useSearchParams().get('q') ?? ''
  const world = useWorld()
  const r = search(world, q)
  const total = r ? Object.values(r).reduce((n, l) => n + l.length, 0) : 0

  return (
    <Shell width="max-w-5xl" className="@container">
      <h1 className="font-serif text-4xl">{q ? <>Results for “{q}”</> : 'Search PLACES'}</h1>
      <SearchField key={q} placeholder="Search people, places, products, jobs, or topics..." size="lg" className="mt-5" defaultValue={q} />
      {r && <p className="mt-3 text-sm text-muted">{total} result{total === 1 ? '' : 's'}</p>}
      {r && (
        <div className="mt-8 grid gap-10">
          {r.people.length > 0 && (
            <section className="grid gap-3">
              <SectionHeader title="People" href="/explore" action="Explore" />
              <div className="grid gap-3 @3xl:grid-cols-2">
                {r.people.map((p) => (
                  <Link key={p.id} href={`/people/?u=${p.username}`}>
                    <Card lift className="flex items-center gap-3 p-4">
                      <Avatar src={p.avatar} alt="" name={p.name} size={44} />
                      <span>
                        <span className="block font-semibold">{p.name}</span>
                        <span className="text-sm text-muted">{p.headline || `@${p.username}`}</span>
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {r.courses.length > 0 && (
            <section className="grid gap-3">
              <SectionHeader title="Courses & guides" href="/mindplace" action="MindPlace" />
              <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">{r.courses.map((c) => <LearningCard key={c.id} course={c} />)}</div>
            </section>
          )}
          {r.discussions.length > 0 && (
            <section className="grid gap-1">
              <SectionHeader title="Discussions" href="/mindplace" action="MindPlace" />
              <ul className="divide-y divide-line/60">{r.discussions.map((d) => <DiscussionRow key={d.id} d={d} />)}</ul>
            </section>
          )}
          {(r.products.length > 0 || r.shops.length > 0) && (
            <section className="grid gap-3">
              <SectionHeader title="MarketPlace" href="/marketplace" action="MarketPlace" />
              <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
                {r.shops.map((s) => <ShopCard key={s.id} shop={s} />)}
                {r.products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </section>
          )}
          {r.opportunities.length > 0 && (
            <section className="grid gap-3">
              <SectionHeader title="Opportunities" href="/workplace" action="WorkPlace" />
              {r.opportunities.map((o) => <OpportunityRow key={o.id} o={o} />)}
            </section>
          )}
          {r.posts.length > 0 && (
            <section className="grid gap-3">
              <SectionHeader title="Posts" href="/yourplace" action="YourPlace" />
              {r.posts.map((p) => <PostCard key={p.id} post={p} />)}
            </section>
          )}
          {total === 0 && <p className="rounded-2xl bg-white/60 py-12 text-center text-muted">Nothing matched. Try a different word.</p>}
        </div>
      )}
    </Shell>
  )
}

/* ------------------------------------------------------------------ */
/* Activity — orders, applications, learning, listings                  */
/* ------------------------------------------------------------------ */

const ACTIVITY_TABS = ['Orders', 'Applications', 'Learning', 'Selling & hiring'] as const
type ActivityTab = (typeof ACTIVITY_TABS)[number]
/** `?tab=` values, so the account menu can open Orders (MarketPlace) and Applications (WorkPlace) directly. */
const TAB_PARAM: Record<string, ActivityTab> = { orders: 'Orders', applications: 'Applications', learning: 'Learning', selling: 'Selling & hiring' }

export function ActivityPage() {
  const param = useSearchParams().get('tab') ?? ''
  return <Activity key={param} initial={TAB_PARAM[param] ?? 'Orders'} />
}

function Activity({ initial }: { initial: ActivityTab }) {
  const world = useWorld()
  const ready = useHydrated()
  const [tab, setTab] = useState<ActivityTab>(initial)
  const acc = me(world)

  if (ready && !acc)
    return (
      <Shell width="max-w-4xl">
        <SignInPrompt title="Your activity" text="Orders, applications and learning progress live here." />
      </Shell>
    )
  if (!acc) return <Shell width="max-w-4xl">{null}</Shell>

  const myShop = world.shops.find((s) => s.ownerId === acc.id)
  const orders = world.orders.filter((o) => o.buyerId === acc.id)
  const sales = myShop ? world.orders.filter((o) => world.products.find((p) => p.id === o.productId)?.shopId === myShop.id) : []
  const apps = world.applications.filter((a) => a.applicantId === acc.id)
  const myOpps = world.opportunities.filter((o) => o.postedById === acc.id)
  const learning = enrollmentsOf(world, acc.id)

  const productRow = (orderId: string, productId: string, total: number, via: string, at: number, who?: string, fee?: number) => {
    const p = world.products.find((x) => x.id === productId)
    return (
      <Card key={orderId} className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <Link href={`/marketplace/product/?id=${productId}`} className="block truncate font-semibold hover:underline">
            {p?.title ?? 'Removed product'}
          </Link>
          <p className="text-sm text-muted">
            {who && `${who} · `}
            <TimeAgo ts={at} />
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{formatPrice(total)}</p>
          {fee ? <p className="text-xs text-muted">1% platform fee {formatPrice(fee)}</p> : null}
          <Tag tone={via === 'stripe' ? 'teal' : 'neutral'}>{via === 'stripe' ? 'Paid via Stripe' : 'Test order'}</Tag>
        </div>
      </Card>
    )
  }

  return (
    <Shell width="max-w-4xl">
      <h1 className="font-serif text-4xl">Activity</h1>
      <div role="tablist" className="scrollbar-none mt-5 flex gap-2 overflow-x-auto">
        {ACTIVITY_TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('h-10 shrink-0 rounded-full border px-5 text-sm font-medium', tab === t ? 'border-teal bg-teal text-white' : 'border-line bg-white')}>
            {t}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-3">
        {tab === 'Orders' && (orders.length ? orders.map((o) => productRow(o.id, o.productId, o.total, o.via, o.createdAt)) : <Empty text="No orders yet." href="/marketplace" cta="Browse MarketPlace" />)}
        {tab === 'Applications' &&
          (apps.length ? (
            apps.map((a) => {
              const o = world.opportunities.find((x) => x.id === a.opportunityId)
              return (
                <Card key={a.id} className="p-4">
                  <Link href={`/workplace/opportunity/?id=${a.opportunityId}`} className="font-semibold hover:underline">
                    {o?.title ?? 'Closed opportunity'}
                  </Link>
                  <p className="text-sm text-muted">
                    {o?.org} · applied <TimeAgo ts={a.createdAt} />
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-navy-soft">{a.message}</p>
                </Card>
              )
            })
          ) : (
            <Empty text="No applications yet." href="/workplace" cta="Find opportunities" />
          ))}
        {tab === 'Learning' &&
          (learning.length ? (
            learning.map((e) => {
              const c = world.courses.find((x) => x.id === e.courseId)
              if (!c) return null
              const pct = Math.round((e.completed.length / c.lessons.length) * 100)
              return (
                <Link key={c.id} href={`/mindplace/course/?id=${c.id}`}>
                  <Card lift className="p-4">
                    <div className="flex justify-between">
                      <p className="font-semibold">{c.title}</p>
                      <p className="text-sm text-muted">{pct}%</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-ivory">
                      <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
                    </div>
                  </Card>
                </Link>
              )
            })
          ) : (
            <Empty text="You haven’t started a course yet." href="/mindplace" cta="Explore MindPlace" />
          ))}
        {tab === 'Selling & hiring' && (
          <>
            <h2 className="mt-2 font-semibold">Sales{myShop ? ` · ${myShop.name}` : ''}</h2>
            {sales.length ? sales.map((o) => productRow(o.id, o.productId, o.total, o.via, o.createdAt, person(world, o.buyerId).name, o.fee)) : <p className="text-sm text-muted">{myShop ? 'No sales yet.' : 'You don’t have a shop yet.'}</p>}
            <h2 className="mt-4 font-semibold">Course sales</h2>
            {(() => {
              const mineCourses = world.courses.filter((c) => c.expertId === acc.id)
              const cs = (world.coursePurchases ?? []).filter((p) => mineCourses.some((c) => c.id === p.courseId))
              return cs.length ? (
                cs.map((p) => (
                  <Card key={p.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <Link href={`/mindplace/course/?id=${p.courseId}`} className="block truncate font-semibold hover:underline">
                        {mineCourses.find((c) => c.id === p.courseId)?.title}
                      </Link>
                      <p className="text-sm text-muted">
                        {person(world, p.buyerId).name} · <TimeAgo ts={p.createdAt} />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatPrice(p.total)}</p>
                      {p.fee ? <p className="text-xs text-muted">5% platform fee {formatPrice(p.fee)}</p> : null}
                      <Tag tone={p.via === 'stripe' ? 'teal' : 'neutral'}>{p.via === 'stripe' ? 'Paid via Stripe' : 'Test purchase'}</Tag>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted">{mineCourses.length ? 'No course sales yet.' : 'You haven’t published a course yet.'}</p>
              )
            })()}
            <h2 className="mt-4 font-semibold">Your opportunities</h2>
            {myOpps.length ? (
              myOpps.map((o) => (
                <Link key={o.id} href={`/workplace/opportunity/?id=${o.id}`}>
                  <Card lift className="flex justify-between p-4">
                    <span className="font-semibold">{o.title}</span>
                    <span className="text-sm text-muted">{world.applications.filter((a) => a.opportunityId === o.id).length} applicants</span>
                  </Card>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted">You haven’t posted any opportunities.</p>
            )}
          </>
        )}
      </div>
    </Shell>
  )
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl bg-white/60 py-12 text-center">
      <p className="text-muted">{text}</p>
      <ButtonLink href={href} variant="soft" size="sm" className="mt-4">
        {cta}
      </ButtonLink>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

const INTERESTS = ['Sustainability', 'Wellness', 'Handmade', 'Remote work', 'Design', 'Gardening', 'Travel', 'Business', 'Writing', 'Tech']
const OPEN_TO: Account['openTo'] = ['jobs', 'freelance', 'collaboration']

export function SettingsPage() {
  const world = useWorld()
  const ready = useHydrated()
  const acc = me(world)
  if (ready && !acc)
    return (
      <Shell width="max-w-2xl">
        <SignInPrompt title="Settings" text="Sign in to edit your profile." />
      </Shell>
    )
  if (!acc) return <Shell width="max-w-2xl">{null}</Shell>
  return <SettingsForm key={acc.id} acc={acc} />
}

function SettingsForm({ acc }: { acc: Account }) {
  const router = useRouter()
  const world = useWorld()
  const cloud = getWorldMode() === 'cloud'
  const [f, setF] = useState({ name: acc.name, headline: acc.headline, bio: acc.bio, location: acc.location, website: acc.website ?? '', skills: acc.skills.join(', ') })
  const [avatar, setAvatar] = useState<string | undefined>(acc.avatar || undefined)
  const [interests, setInterests] = useState(acc.interests)
  const [openTo, setOpenTo] = useState<string[]>(acc.openTo)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const exportData = () => {
    const mine = {
      account: acc,
      posts: world.posts.filter((p) => p.authorId === acc.id),
      discussions: world.discussions.filter((d) => d.authorId === acc.id),
      shop: world.shops.find((s) => s.ownerId === acc.id),
      products: world.products.filter((p) => world.shops.find((s) => s.id === p.shopId)?.ownerId === acc.id),
      orders: world.orders.filter((o) => o.buyerId === acc.id),
      applications: world.applications.filter((a) => a.applicantId === acc.id),
      opportunities: world.opportunities.filter((o) => o.postedById === acc.id),
      messages: world.threads.filter((t) => t.participantIds.includes(acc.id)),
      saved: world.saved[acc.id] ?? [],
      collections: world.collections[acc.id] ?? [],
      learning: world.enrollments[acc.id] ?? [],
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(mine, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `places-${acc.username}.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Shell width="max-w-2xl">
      <h1 className="font-serif text-4xl">Settings</h1>
      <form
        className="mt-6 grid gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          perform(
            (s) =>
              updateProfile(s, {
                name: f.name,
                headline: f.headline.trim(),
                bio: f.bio.trim(),
                location: f.location.trim(),
                website: f.website,
                avatar: avatar ?? '',
                interests,
                openTo: openTo as Account['openTo'],
                skills: f.skills.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12),
              }),
            'Profile saved.',
          )
        }}
      >
        <Card className="grid gap-5 p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <ImagePicker label="Photo" value={avatar} onChange={setAvatar} shape="round" />
          <TextField label="Name" value={f.name} onChange={set('name')} required />
          <TextField label="Headline" value={f.headline} onChange={set('headline')} placeholder="e.g. Ceramicist & teacher" maxLength={80} />
          <TextArea label="Bio" value={f.bio} onChange={set('bio')} rows={3} maxLength={300} />
          <TextField label="Location" value={f.location} onChange={set('location')} />
          <TextField label="Website" type="text" inputMode="url" value={f.website} onChange={set('website')} placeholder="mystudio.com" maxLength={200} />
          <ChipPicker label="Interests" options={INTERESTS} value={interests} onChange={setInterests} />
        </Card>
        <Card className="grid gap-5 p-6">
          <h2 className="text-lg font-semibold">Work profile</h2>
          <TextField label="Skills" value={f.skills} onChange={set('skills')} hint="Separate with commas." />
          <ChipPicker label="Open to" options={OPEN_TO} value={openTo} onChange={setOpenTo} />
        </Card>
        <Button type="submit" size="lg" className="!text-base">
          Save changes
        </Button>
      </form>

      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Plan</h2>
          <p className="text-sm text-muted">
            {(() => {
              const active = (['pass', 'create', 'host'] as const).filter((k) => activePlan(world, k)).map((k) => PLANS[k].name)
              return active.length ? `Active: ${active.join(', ')}.` : 'PLACES Free — everything you need to explore and belong.'
            })()}
          </p>
        </div>
        <ButtonLink href="/pricing" variant="outline" size="sm">
          {activePlan(world, 'pass') ? 'Manage plans' : 'See PLACES Pass'}
        </ButtonLink>
      </Card>

      <Card className="mt-4 grid gap-4 p-6">
        <h2 className="text-lg font-semibold">Account & data</h2>
        <p className="text-sm text-muted">
          Signed in as <span className="font-medium text-navy">@{acc.username}</span> ({acc.email}).{' '}
          {cloud ? 'Your place is saved in PLACES, so it’s the same on every device.' : 'Your data is stored on this device.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4" /> Download my data
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void leaveRoomAndSignOut()
              perform(signOut, 'Signed out.')
              router.push('/')
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
        <div className="mt-2 rounded-2xl border border-coral/30 bg-[#fff6f3] p-4">
          <p className="font-medium text-[#a2412c]">Delete account</p>
          <p className="mt-1 text-sm text-navy-soft">Permanently removes your profile and everything you created{cloud ? ' in PLACES' : ' on this device'}.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="!border-coral/50 !text-[#a2412c]"
              onClick={async () => {
                if (!confirm('Delete your account and everything you created? This cannot be undone.')) return
                if (cloud) {
                  try {
                    await deleteCloudAccount()
                  } catch (e) {
                    return toast((e as Error).message, 'error')
                  }
                } else void leaveRoomAndSignOut()
                perform(deleteAccount, 'Your account was deleted.')
                router.push('/')
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete my account
            </Button>
            {!cloud && <button
              onClick={async () => {
                if (confirm('Reset PLACES on this device? All accounts and content on this device will be removed.')) {
                  await resetDevice()
                  router.push('/')
                }
              }}
              className="text-sm text-muted underline"
            >
              Reset this device
            </button>}
          </div>
        </div>
      </Card>
    </Shell>
  )
}
