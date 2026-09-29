'use client'

import { useState } from 'react'
import { ProductCard, ShopCard } from '@/components/cards'
import { SearchField } from '@/components/search/SearchField'
import { FilterPills } from '@/components/ui/FilterPills'
import { Button, SectionHeader } from '@/components/ui/primitives'
import { useWorld, withAuth } from '@/lib/store/hooks'
import { openCreate } from '@/lib/ui'

const CATEGORIES = ['All', 'Handmade', 'Digital', 'Home', 'Wellness', 'Services']

export function MarketPlaceApp({ compact = false }: { compact?: boolean }) {
  const world = useWorld()
  const [cat, setCat] = useState('All')
  const products = world.products.filter((p) => cat === 'All' || p.category === cat)

  return (
    <div className="flex flex-col gap-4 p-4 @3xl:gap-8 @3xl:px-0 @3xl:py-8">
      <SearchField placeholder="Search products, services, or shops..." size="sm" className="@3xl:hidden" />
      <div className="flex items-center gap-3">
        <FilterPills label="MarketPlace categories" options={CATEGORIES} value={cat} onChange={setCat} className="min-w-0 flex-1" />
        {!compact && (
          <Button size="sm" onClick={() => withAuth(() => openCreate('product'), 'Join PLACES FOR US to open your shop.')} className="hidden shrink-0 @3xl:inline-flex @3xl:!h-9">
            + Sell something
          </Button>
        )}
      </div>

      {cat === 'All' && (
        <section className="flex flex-col gap-2.5 @3xl:gap-5">
          <SectionHeader title="Featured Shops" href="/marketplace" />
          <div className="grid grid-cols-3 gap-2.5 @3xl:gap-6">
            {world.shops.slice(0, compact ? 3 : undefined).map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2.5 @3xl:gap-5">
        <SectionHeader title={cat === 'All' ? 'Trending Products' : cat} href="/marketplace" />
        {products.length ? (
          <div className="grid grid-cols-4 gap-2 @3xl:gap-6">
            {products.slice(0, compact ? 4 : undefined).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white/60 py-10 text-center text-sm text-muted">Nothing in {cat} yet — be the first to list something.</p>
        )}
      </section>

      {!compact && (
        <Button onClick={() => withAuth(() => openCreate('product'), 'Join PLACES FOR US to open your shop.')} className="@3xl:hidden">
          + Sell something
        </Button>
      )}
    </div>
  )
}
