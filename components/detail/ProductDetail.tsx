'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Copy, CreditCard, MessageCircle, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ProductCard, SaveButton } from '@/components/cards'
import { Picture } from '@/components/ui/Picture'
import { Button, Card } from '@/components/ui/primitives'
import { STRIPE_LINK_RE, deleteProduct, openThread, placeOrder, updateProduct } from '@/lib/store/actions'
import { perform, useHydrated, useWorld, withAuth } from '@/lib/store/hooks'
import { formatPrice, person } from '@/lib/store/selectors'
import { withBase } from '@/lib/base-path'
import { toast } from '@/lib/ui'
import { NotFoundHere, Shell } from './Shell'

const PENDING = 'places:pending-checkout'

/** The URL sellers set as their Payment Link's confirmation redirect. */
export const confirmationUrl = (productId: string) =>
  typeof window === 'undefined' ? '' : `${window.location.origin}${withBase(`/marketplace/product/?id=${productId}&paid=1`)}`

export function ProductDetail() {
  const params = useSearchParams()
  const id = params.get('id')
  const paid = params.get('paid') === '1'
  const router = useRouter()
  const world = useWorld()
  const ready = useHydrated()
  const handled = useRef(false)
  const p = world.products.find((x) => x.id === id)
  const shop = p && world.shops.find((x) => x.id === p.shopId)
  const owner = shop && person(world, shop.ownerId)
  const mine = !!shop && shop.ownerId === world.accountId

  // Returning from Stripe: record the order once for the checkout this device started.
  useEffect(() => {
    if (!ready || !paid || !p || handled.current) return
    handled.current = true
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING) ?? 'null') as { productId: string; at: number } | null
      if (pending?.productId === p.id && Date.now() - pending.at < 6 * 3_600_000 && world.accountId) {
        perform((s, now) => placeOrder(s, p.id, 'stripe', now), 'Payment complete — thank you! Your order is saved in Activity.')
        sessionStorage.removeItem(PENDING)
      }
    } catch {}
    router.replace(`/marketplace/product/?id=${p.id}`)
  }, [ready, paid, p, world.accountId, router])

  if (!p || !shop || !owner)
    return (
      <Shell back={{ href: '/marketplace', label: 'MarketPlace' }}>
        <NotFoundHere what="product" href="/marketplace" label="Back to MarketPlace" />
      </Shell>
    )

  const buy = () =>
    withAuth(() => {
      if (p.stripeLink) {
        try {
          sessionStorage.setItem(PENDING, JSON.stringify({ productId: p.id, at: Date.now() }))
        } catch {}
        window.location.href = p.stripeLink
      } else if (confirm(`Place a test order for ${p.title}? No payment is taken — the seller hasn’t connected Stripe for this product yet.`)) {
        perform((s, now) => placeOrder(s, p.id, 'test', now), 'Test order placed. You’ll find it in Activity.')
      }
    }, 'Join PLACES to buy from independent shops.')

  const message = () =>
    withAuth(() => {
      const r = perform((s, now) => openThread(s, shop.ownerId, { kind: 'product', refId: p.id, label: p.title }, now))
      if (r.ok) router.push(`/messages/?t=${r.id}`)
    }, 'Join PLACES to message sellers.')

  const more = world.products.filter((x) => x.shopId === shop.id && x.id !== p.id).slice(0, 4)

  return (
    <Shell back={{ href: '/marketplace', label: 'MarketPlace' }}>
      <div className="grid gap-8 md:grid-cols-2 md:items-start">
        <div className="relative aspect-square overflow-hidden rounded-panel bg-sand shadow-soft">
          <Picture src={p.image} alt={p.title} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
        <div>
          <Link href={`/marketplace/shop/?id=${shop.id}`} className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-deep hover:underline">
            {shop.name}
          </Link>
          <h1 className="mt-2 font-serif text-[clamp(2.2rem,5vw,3.2rem)] leading-[1.02]">{p.title}</h1>
          <p className="mt-3 text-2xl font-semibold">{formatPrice(p.price)}</p>
          <p className="mt-5 whitespace-pre-line leading-relaxed text-navy-soft">{p.description}</p>

          {!mine && (
            <>
              <div className="mt-7 flex gap-3">
                <Button size="lg" className="flex-1 !text-base" onClick={buy}>
                  {p.stripeLink ? (
                    <>
                      <CreditCard className="h-5 w-5" /> Buy now
                    </>
                  ) : (
                    'Place a test order'
                  )}
                </Button>
                <SaveButton refItem={{ kind: 'product', refId: p.id }} variant="heart" className="grid h-14 w-14 place-items-center rounded-full border border-line bg-white text-xl" />
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                {p.stripeLink ? `Secure checkout with Stripe. You pay ${shop.name} directly.` : 'This seller hasn’t connected Stripe for this product yet, so orders are test orders with no payment.'}
              </p>
              <Button variant="outline" className="mt-5 w-full" onClick={message}>
                <MessageCircle className="h-4 w-4" /> Message {owner.name.split(' ')[0]}
              </Button>
            </>
          )}

          {mine && <SellerPanel productId={p.id} stripeLink={p.stripeLink} />}
        </div>
      </div>

      {more.length > 0 && (
        <section className="@container mt-14">
          <h2 className="mb-5 font-serif text-3xl">More from {shop.name}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {more.map((x) => (
              <ProductCard key={x.id} product={x} />
            ))}
          </div>
        </section>
      )}
    </Shell>
  )
}

function SellerPanel({ productId, stripeLink }: { productId: string; stripeLink?: string }) {
  const router = useRouter()
  const [link, setLink] = useState(stripeLink ?? '')
  const url = confirmationUrl(productId)
  return (
    <Card className="mt-7 grid gap-4 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your listing</p>
      <div className="grid gap-1.5">
        <label htmlFor="stripe-link" className="text-sm font-medium">
          Stripe Payment Link
        </label>
        <div className="flex gap-2">
          <input id="stripe-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://buy.stripe.com/…" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-teal/60" />
          <Button
            className="!h-11"
            onClick={() => {
              if (link && !STRIPE_LINK_RE.test(link)) return toast('Paste a Stripe Payment Link (it starts with https://buy.stripe.com/).', 'error')
              perform((s) => updateProduct(s, productId, { stripeLink: link || undefined }), link ? 'Stripe checkout connected.' : 'Stripe link removed.')
            }}
          >
            Save
          </Button>
        </div>
      </div>
      <div className="grid gap-1.5 text-sm">
        <p className="font-medium">Confirmation page for Stripe</p>
        <p className="text-muted">In your Payment Link settings, choose “Don’t show confirmation page → redirect customers to your website” and paste this URL so orders are recorded:</p>
        <button
          onClick={() => navigator.clipboard?.writeText(url).then(() => toast('Copied.'))}
          className="flex items-center gap-2 break-all rounded-xl bg-ivory px-3 py-2 text-left font-mono text-xs text-navy-soft hover:bg-sand"
        >
          <Copy className="h-3.5 w-3.5 shrink-0" /> {url}
        </button>
      </div>
      <button
        onClick={() => {
          if (confirm('Remove this listing?')) {
            perform((s) => deleteProduct(s, productId), 'Listing removed.')
            router.push('/marketplace')
          }
        }}
        className="inline-flex items-center gap-1.5 justify-self-start text-sm text-muted hover:text-coral"
      >
        <Trash2 className="h-4 w-4" /> Remove listing
      </button>
    </Card>
  )
}
