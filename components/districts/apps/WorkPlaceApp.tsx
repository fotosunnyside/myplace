'use client'

import { useState } from 'react'
import { OpportunityRow } from '@/components/cards'
import { SearchField } from '@/components/search/SearchField'
import { FilterPills } from '@/components/ui/FilterPills'
import { Card, SectionHeader } from '@/components/ui/primitives'
import { opportunities } from '@/lib/data/content'
import { currentUser } from '@/lib/data/identity'

const FILTERS = ['All', 'Jobs', 'Services', 'Freelancers', 'Projects', 'Teams']

const matches = (filter: string, type: string) =>
  filter === 'All' ||
  (filter === 'Jobs' && /Full|Part/.test(type)) ||
  (filter === 'Projects' && type === 'Project') ||
  (filter === 'Freelancers' && /Freelance|Flexible/.test(type)) ||
  filter === 'Services' ||
  filter === 'Teams'

export function WorkPlaceApp({ compact = false }: { compact?: boolean }) {
  const [filter, setFilter] = useState('All')
  const list = opportunities.filter((o) => matches(filter, o.type)).slice(0, compact ? 4 : undefined)
  const { professional } = currentUser.activity

  return (
    <div className="flex flex-col gap-4 p-4 @3xl:gap-8 @3xl:px-0 @3xl:py-8">
      <SearchField placeholder="Search jobs, services, or people..." size="sm" className="@3xl:hidden" />
      <FilterPills label="WorkPlace filter" options={FILTERS} value={filter} onChange={setFilter} />

      <div className="grid gap-8 @5xl:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-2.5 @3xl:gap-4">
          <SectionHeader title="Featured Opportunities" />
          <div className="flex flex-col gap-2 @3xl:gap-3">
            {list.map((o) => (
              <OpportunityRow key={o.id} o={o} />
            ))}
          </div>
        </section>

        {!compact && (
          <aside className="hidden flex-col gap-4 @5xl:flex">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your work profile</p>
              <p className="mt-3 font-serif text-xl leading-snug">{professional.headline}</p>
              <p className="mt-2 text-sm text-muted">Open to {professional.openTo.join(' & ')}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {currentUser.profile.skills.map((s) => (
                  <span key={s} className="rounded-full bg-teal-wash px-2.5 py-1 text-xs font-medium text-teal-deep">
                    {s}
                  </span>
                ))}
              </div>
            </Card>
            <Card className="p-5 text-sm">
              <p className="font-semibold">{professional.applications} active applications</p>
              <p className="mt-1 text-muted">{professional.projects} projects shown on your profile</p>
            </Card>
          </aside>
        )}
      </div>
    </div>
  )
}
