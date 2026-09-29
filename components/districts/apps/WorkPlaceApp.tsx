'use client'

import Link from 'next/link'
import { useState } from 'react'
import { OpportunityRow } from '@/components/cards'
import { SearchField } from '@/components/search/SearchField'
import { FilterPills } from '@/components/ui/FilterPills'
import { Button, ButtonLink, Card, SectionHeader } from '@/components/ui/primitives'
import { useWorld, withAuth } from '@/lib/store/hooks'
import { me } from '@/lib/store/selectors'
import type { Opportunity } from '@/lib/types'
import { openAuth, openCreate } from '@/lib/ui'

const FILTERS = ['All', 'Jobs', 'Services', 'Freelancers', 'Projects', 'Teams']
const matches = (f: string, o: Opportunity) =>
  f === 'All' ||
  (f === 'Jobs' && o.kind === 'job') ||
  (f === 'Services' && o.kind === 'service') ||
  (f === 'Freelancers' && (o.type === 'Freelance' || o.type === 'Flexible')) ||
  (f === 'Projects' && o.kind === 'project') ||
  (f === 'Teams' && o.kind === 'team')

export function WorkPlaceApp({ compact = false }: { compact?: boolean }) {
  const world = useWorld()
  const account = me(world)
  const [filter, setFilter] = useState('All')
  const list = world.opportunities.filter((o) => matches(filter, o)).slice(0, compact ? 4 : undefined)
  const applied = account ? world.applications.filter((a) => a.applicantId === account.id).length : 0
  const posted = account ? world.opportunities.filter((o) => o.postedById === account.id).length : 0

  return (
    <div className="flex flex-col gap-4 p-4 @3xl:gap-8 @3xl:px-0 @3xl:py-8">
      <SearchField placeholder="Search jobs, services, or people..." size="sm" className="@3xl:hidden" />
      <FilterPills label="WorkPlace filter" options={FILTERS} value={filter} onChange={setFilter} />

      <div className="grid gap-8 @5xl:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-2.5 @3xl:gap-4">
          <SectionHeader title="Featured Opportunities" href="/workplace" />
          <div className="flex flex-col gap-2 @3xl:gap-3">
            {list.map((o) => (
              <OpportunityRow key={o.id} o={o} />
            ))}
            {list.length === 0 && <p className="rounded-2xl bg-white/60 py-10 text-center text-sm text-muted">No {filter.toLowerCase()} right now.</p>}
          </div>
        </section>

        {!compact && (
          <aside className="flex flex-col gap-4">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your work profile</p>
              {account ? (
                <>
                  <p className="mt-3 font-serif text-xl leading-snug">{account.headline || 'Add a headline in Settings'}</p>
                  <p className="mt-2 text-sm text-muted">{account.openTo.length ? `Open to ${account.openTo.join(' & ')}` : 'Let people know what you’re open to.'}</p>
                  {account.skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {account.skills.map((s) => (
                        <span key={s} className="rounded-full bg-teal-wash px-2.5 py-1 text-xs font-medium text-teal-deep">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <ButtonLink href="/settings" size="sm" variant="outline" className="mt-4 w-full">
                    Edit work profile
                  </ButtonLink>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm text-navy-soft">Join to apply in one tap with your PLACES profile.</p>
                  <Button size="sm" className="mt-4 w-full" onClick={() => openAuth({ mode: 'join' })}>
                    Join PLACES FOR US
                  </Button>
                </>
              )}
            </Card>
            <Card className="p-5 text-sm">
              <p>
                <Link href="/activity" className="font-semibold hover:underline">
                  {applied} application{applied === 1 ? '' : 's'}
                </Link>{' '}
                · {posted} posted
              </p>
              {account && (
                <Link href="/workrooms" className="mt-3 flex items-center justify-between rounded-xl bg-ivory px-3 py-2.5 font-medium hover:bg-sand">
                  Your workrooms <span className="text-muted">{(world.workrooms ?? []).filter((w) => w.memberIds.includes(account.id)).length} →</span>
                </Link>
              )}
              <Button size="sm" variant="soft" className="mt-3 w-full" onClick={() => withAuth(() => openCreate('opportunity'), 'Join PLACES FOR US to post an opportunity.')}>
                + Post an opportunity
              </Button>
            </Card>
          </aside>
        )}
      </div>
    </div>
  )
}
