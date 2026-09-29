'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessageCircle, Plus } from 'lucide-react'
import { ProductCard, SaveButton } from '@/components/cards'
import { Picture } from '@/components/ui/Picture'
import { Avatar, Button } from '@/components/ui/primitives'
import { openThread } from '@/lib/store/actions'
import { perform, useWorld, withAuth } from '@/lib/store/hooks'
import { person } from '@/lib/store/selectors'
import { openCreate } from '@/lib/ui'
import { NotFoundHere, Shell } from './Shell'

export function ShopDetail() {
  const id = useSearchParams().get('id')
  const world = useWorld()
  const router = useRouter()
  const shop = world.shops.find((x) => x.id === id)

  if (!shop)
    return (
      <Shell back={{ href: '/marketplace', label: 'MarketPlace' }}>
        <NotFoundHere what="shop" href="/marketplace" label="Back to MarketPlace" />
      </Shell>
    )

  const owner = person(world, shop.ownerId)
  const mine = shop.ownerId === world.accountId
  const products = world.products.filter((p) => p.shopId === shop.id)

  return (
    <Shell back={{ href: '/marketplace', label: 'MarketPlace' }}>
      <div className="relative aspect-[3/1] min-h-44 overflow-hidden rounded-panel shadow-soft">
        <Picture src={shop.image} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-navy/10 to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">{shop.category}</p>
            <h1 className="font-serif text-[clamp(2rem,5vw,3.4rem)] leading-none">{shop.name}</h1>
          </div>
          <SaveButton refItem={{ kind: 'shop', refId: shop.id }} variant="heart" className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-xl text-navy" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Link href={`/people/?u=${owner.username}`} className="flex items-center gap-3">
          <Avatar src={owner.avatar} alt="" name={owner.name} size={44} />
          <span className="text-sm">
            <span className="block font-semibold">{owner.name}</span>
            <span className="text-muted">Shop owner</span>
          </span>
        </Link>
        {mine ? (
          <Button onClick={() => openCreate('product')}>
            <Plus className="h-4 w-4" /> Add a product
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() =>
              withAuth(() => {
                const r = perform((s, now) => openThread(s, shop.ownerId, { kind: 'shop', refId: shop.id, label: shop.name }, now))
                if (r.ok) router.push(`/messages/?t=${r.id}`)
              }, 'Join PLACES FOR US to message shop owners.')
            }
          >
            <MessageCircle className="h-4 w-4" /> Message the shop
          </Button>
        )}
      </div>
      {shop.description && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-navy-soft">{shop.description}</p>}

      <section className="@container mt-10">
        <h2 className="mb-5 font-serif text-3xl">Products</h2>
        {products.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white/60 py-12 text-center text-muted">{mine ? 'Add your first product to start selling.' : 'No products yet.'}</p>
        )}
      </section>
    </Shell>
  )
}
