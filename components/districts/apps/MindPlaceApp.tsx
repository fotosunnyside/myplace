'use client'

import { useState } from 'react'
import { DiscussionRow, LearningCard } from '@/components/cards'
import { SearchField } from '@/components/search/SearchField'
import { FilterPills } from '@/components/ui/FilterPills'
import { SectionHeader } from '@/components/ui/primitives'
import { discussions, learning } from '@/lib/data/content'

const FILTERS = ['All', 'Courses', 'Discussions', 'Guides', 'Experts', 'Live']

export function MindPlaceApp({ compact = false }: { compact?: boolean }) {
  const [filter, setFilter] = useState('All')

  const showLearning = filter !== 'Discussions' && filter !== 'Experts'
  const showDiscussions = filter === 'All' || filter === 'Discussions' || filter === 'Experts'
  const items = learning.filter(
    (l) => filter === 'All' || (filter === 'Courses' && l.kind === 'course') || (filter === 'Guides' && l.kind === 'guide') || (filter === 'Live' && l.kind === 'live'),
  )

  return (
    <div className="flex flex-col gap-4 p-4 @3xl:gap-8 @3xl:px-0 @3xl:py-8">
      <SearchField placeholder="Search topics, courses, or people..." size="sm" className="@3xl:hidden" />
      <FilterPills label="MindPlace filter" options={FILTERS} value={filter} onChange={setFilter} />

      {showLearning && (
        <section className="flex flex-col gap-2.5 @3xl:gap-5">
          <SectionHeader title="Featured Learning" />
          <div className="grid grid-cols-3 gap-2 @3xl:grid-cols-4 @3xl:gap-5">
            {items.slice(0, compact ? 3 : 4).map((l) => (
              <LearningCard key={l.id} item={l} />
            ))}
          </div>
        </section>
      )}

      {showDiscussions && (
        <section className="flex flex-col @3xl:gap-2">
          <SectionHeader title="Popular Discussions" />
          <ul className="divide-y divide-line/60">
            {discussions.slice(0, compact ? 3 : undefined).map((d) => (
              <DiscussionRow key={d.id} d={d} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
