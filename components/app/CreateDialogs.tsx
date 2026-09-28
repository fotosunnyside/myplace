'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { useState } from 'react'
import { DistrictIcon } from '@/components/districts/DistrictIcon'
import { Dialog } from '@/components/ui/Dialog'
import { ImagePicker, Select, TextArea, TextField } from '@/components/ui/fields'
import { Button } from '@/components/ui/primitives'
import { DISCUSSION_CATEGORIES, createDiscussion, createOpportunity, createPost, createProduct, createShop } from '@/lib/store/actions'
import { perform, useWorld, withAuth } from '@/lib/store/hooks'
import { shopOf } from '@/lib/store/selectors'
import { closeCreate, openCreate, useCreate, type CreateKind } from '@/lib/ui'
import { orderedDistricts } from '@/lib/world/districts'
import type { Opportunity, Product } from '@/lib/types'

const MENU: Record<string, { label: string; kind: Exclude<CreateKind, 'menu' | null> }> = {
  yourplace: { label: 'Share a post', kind: 'post' },
  mindplace: { label: 'Start a discussion', kind: 'discussion' },
  marketplace: { label: 'List a product', kind: 'product' },
  workplace: { label: 'Post an opportunity', kind: 'opportunity' },
}

const TITLES: Record<Exclude<CreateKind, null>, [string, string?]> = {
  menu: ['Create in PLACES', 'One identity — create anywhere.'],
  post: ['Share a post', 'Posts appear on your YourPlace profile and in friends’ feeds.'],
  discussion: ['Start a discussion', 'Ask a question or share what you know in MindPlace.'],
  product: ['List a product', 'Sell in MarketPlace. Buyers pay you directly through Stripe.'],
  opportunity: ['Post an opportunity', 'Share a job, project or service in WorkPlace.'],
}

export function CreateDialogs() {
  const current = useCreate()
  // Keep showing the last form while the dialog animates out.
  const [kind, setKind] = useState<CreateKind>(current)
  if (current && current !== kind) setKind(current)
  const [title, description] = kind ? TITLES[kind] : ['']
  return (
    <Dialog open={!!current} onClose={closeCreate} title={title} description={description}>
      {kind === 'menu' && <Menu />}
      {kind === 'post' && <PostForm />}
      {kind === 'discussion' && <DiscussionForm />}
      {kind === 'product' && <ProductForm />}
      {kind === 'opportunity' && <OpportunityForm />}
    </Dialog>
  )
}

function Menu() {
  return (
    <ul className="grid gap-2">
      {orderedDistricts().map((d) => (
        <li key={d.id}>
          <button
            onClick={() => withAuth(() => openCreate(MENU[d.id].kind), 'Join PLACES to start creating.')}
            className="flex w-full items-center gap-3 rounded-2xl border border-line/80 bg-white/80 p-3 text-left transition hover:border-teal/30 hover:bg-white"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
              <DistrictIcon icon={d.icon} className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{MENU[d.id].label}</span>
              <span className="text-xs text-muted">in {d.name}</span>
            </span>
          </button>
        </li>
      ))}
      <li>
        <Link href="/teach" onClick={closeCreate} className="flex w-full items-center gap-3 rounded-2xl border border-line/80 bg-white/80 p-3 transition hover:border-teal/30 hover:bg-white">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#fdf2d6] text-[#a8791a]">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold">Publish a course</span>
            <span className="text-xs text-muted">in MindPlace · creator plan</span>
          </span>
        </Link>
      </li>
    </ul>
  )
}

/* ------------------------------------------------------------------ */

export function PostForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [image, setImage] = useState<string>()
  const [link, setLink] = useState('')
  const [location, setLocation] = useState('')
  const [poll, setPoll] = useState<string[] | null>(null)

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const r = perform((s, now) => createPost(s, { body, image, link: link || undefined, location, pollOptions: poll ?? undefined }, now), 'Posted to YourPlace.')
        if (r.ok) {
          closeCreate()
          onDone?.()
          router.push('/yourplace')
        }
      }}
    >
      <TextArea label="What's on your mind?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
      <ImagePicker label="Photo" value={image} onChange={setImage} />
      <TextField label="Link (optional)" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
      <TextField label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
      {poll ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Poll options</legend>
          {poll.map((o, i) => (
            <input
              key={i}
              aria-label={`Option ${i + 1}`}
              value={o}
              onChange={(e) => setPoll(poll.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Option ${i + 1}`}
              className="h-11 rounded-2xl border border-line bg-white px-4 outline-none focus:border-teal/60"
            />
          ))}
          <div className="flex gap-4 text-sm">
            {poll.length < 5 && (
              <button type="button" onClick={() => setPoll([...poll, ''])} className="font-medium text-teal-deep">
                + Add option
              </button>
            )}
            <button type="button" onClick={() => setPoll(null)} className="text-muted">
              Remove poll
            </button>
          </div>
        </fieldset>
      ) : (
        <button type="button" onClick={() => setPoll(['', ''])} className="justify-self-start text-sm font-medium text-teal-deep">
          + Add a poll
        </button>
      )}
      <Button type="submit" size="lg" className="w-full !text-base">
        Post
      </Button>
    </form>
  )
}

function DiscussionForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState(DISCUSSION_CATEGORIES[0])
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const r = perform((s, now) => createDiscussion(s, { title, body, category }, now), 'Discussion started.')
        if (r.ok) {
          closeCreate()
          router.push(`/mindplace/discussion/?id=${r.id}`)
        }
      }}
    >
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What would you like to discuss?" maxLength={140} required />
      <TextArea label="Details" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add context so people can help." maxLength={4000} />
      <Select label="Topic" options={DISCUSSION_CATEGORIES} value={category} onChange={(e) => setCategory(e.target.value)} />
      <Button type="submit" size="lg" className="w-full !text-base">
        Start discussion
      </Button>
    </form>
  )
}

const PRODUCT_CATEGORIES: Product['category'][] = ['Handmade', 'Digital', 'Home', 'Wellness', 'Services']
const SHOP_CATEGORIES = ['Handmade Goods', 'Home & Garden', 'Templates & Tools', 'Wellness', 'Art & Prints', 'Services']

function ProductForm() {
  const world = useWorld()
  const shop = world.accountId ? shopOf(world, world.accountId) : undefined
  return shop ? <NewProduct /> : <NewShop />
}

function NewShop() {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(SHOP_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<string>()
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        perform((s, now) => createShop(s, { name, category, description, image: image ?? '/media/shop-luna.webp' }, now), 'Your shop is open! Now add your first product.')
      }}
    >
      <p className="rounded-2xl bg-teal-wash/60 px-4 py-3 text-sm text-teal-deep">First, open your shop. It takes a minute.</p>
      <TextField label="Shop name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
      <Select label="Category" options={SHOP_CATEGORIES} value={category} onChange={(e) => setCategory(e.target.value)} />
      <TextArea label="About your shop" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={400} />
      <ImagePicker label="Storefront photo" value={image} onChange={setImage} />
      <Button type="submit" size="lg" className="w-full !text-base">
        Open my shop
      </Button>
    </form>
  )
}

function NewProduct() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState<Product['category']>('Handmade')
  const [image, setImage] = useState<string>()
  const [stripeLink, setStripeLink] = useState('')
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const cents = Math.round(parseFloat(price.replace(/[^0-9.]/g, '')) * 100)
        const r = perform((s, now) => createProduct(s, { title, description, price: cents, category, image: image ?? '', stripeLink }, now), 'Listed in MarketPlace.')
        if (r.ok) {
          closeCreate()
          router.push(`/marketplace/product/?id=${r.id}`)
        }
      }}
    >
      <ImagePicker label="Product photo" value={image} onChange={setImage} />
      <TextField label="Product name" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} />
      <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1500} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Price (USD)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="24.00" required />
        <Select label="Category" options={PRODUCT_CATEGORIES} value={category} onChange={(e) => setCategory(e.target.value as Product['category'])} />
      </div>
      <TextField
        label="Stripe Payment Link"
        type="url"
        value={stripeLink}
        onChange={(e) => setStripeLink(e.target.value)}
        placeholder="https://buy.stripe.com/…"
        hint={
          <>
            In your Stripe Dashboard → Payment Links, create a link for this product and paste it here. Set its confirmation page to
            redirect back to this product so the order is recorded. Without a link, buyers can place a test order.
          </>
        }
      />
      <Button type="submit" size="lg" className="w-full !text-base">
        List product
      </Button>
    </form>
  )
}

const TYPES: Opportunity['type'][] = ['Full Time', 'Part Time', 'Flexible', 'Project', 'Freelance']
const KINDS: Record<string, Opportunity['kind']> = { Job: 'job', Project: 'project', Service: 'service', 'Team role': 'team' }

function OpportunityForm() {
  const router = useRouter()
  const world = useWorld()
  const myName = world.accounts.find((a) => a.id === world.accountId)?.name ?? ''
  const [f, setF] = useState({ title: '', org: myName, location: 'Remote', type: TYPES[0], kind: 'Job', tags: '', pay: '', description: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const r = perform(
          (s, now) =>
            createOpportunity(
              s,
              { title: f.title, org: f.org || myName, location: f.location, type: f.type, kind: KINDS[f.kind], pay: f.pay || 'Discuss', description: f.description, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4) },
              now,
            ),
          'Opportunity posted in WorkPlace.',
        )
        if (r.ok) {
          closeCreate()
          router.push(`/workplace/opportunity/?id=${r.id}`)
        }
      }}
    >
      <TextField label="Title" value={f.title} onChange={set('title')} placeholder="e.g. Part-time bookkeeper" required maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Company or name" value={f.org} onChange={set('org')} />
        <TextField label="Location" value={f.location} onChange={set('location')} />
        <Select label="What is it?" options={Object.keys(KINDS)} value={f.kind} onChange={set('kind')} />
        <Select label="Type" options={TYPES} value={f.type} onChange={set('type')} />
      </div>
      <TextField label="Pay" value={f.pay} onChange={set('pay')} placeholder="$30–40/hr" />
      <TextField label="Tags" value={f.tags} onChange={set('tags')} placeholder="Design, Remote, Creative" hint="Separate with commas." />
      <TextArea label="Description" value={f.description} onChange={set('description')} placeholder="What will the person do? What are you looking for?" maxLength={4000} required />
      <Button type="submit" size="lg" className="w-full !text-base">
        Post opportunity
      </Button>
    </form>
  )
}
