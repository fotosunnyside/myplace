'use client'

import { ProductCard, ShopCard } from '@/components/cards'
import { SearchField } from '@/components/search/SearchField'
import { FilterPills } from '@/components/ui/FilterPills'
import { SectionHeader } from '@/components/ui/primitives'
import { products, shops } from '@/lib/data/content'

const CATEGORIES = ['All', 'Handmade', 'Digital', 'Home', 'Wellness', 'Services', 'More']

export function MarketPlaceApp({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-4 p-4 @3xl:gap-8 @3xl:px-0 @3xl:py-8">
      <SearchField placeholder="Search products, services, or shops..." size="sm" className="@3xl:hidden" />
      <FilterPills label="MarketPlace categories" options={CATEGORIES} />

      <section className="flex flex-col gap-2.5 @3xl:gap-5">
        <SectionHeader title="Featured Shops" />
        <div className="grid grid-cols-3 gap-2.5 @3xl:gap-6">
          {shops.map((s) => (
            <ShopCard key={s.id} shop={s} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5 @3xl:gap-5">
        <SectionHeader title="Trending Products" />
        <div className="grid grid-cols-4 gap-2 @3xl:gap-6">
          {products.slice(0, compact ? 4 : undefined).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
