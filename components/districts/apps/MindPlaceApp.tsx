'use client'

import Link from 'next/link'
import { useState } from 'react'
import { DiscussionRow, LearningCard } from '@/components/cards'
import { SearchField } from '@/components/search/SearchField'
import { FilterPills } from '@/components/ui/FilterPills'
import { Avatar, Button, Card, SectionHeader } from '@/components/ui/primitives'
import { useWorld, withAuth } from '@/lib/store/hooks'
import { enrollmentsOf, person } from '@/lib/store/selectors'
import { openCreate } from '@/lib/ui'

const FILTERS = ['All', 'Courses', 'Discussions', 'Guides', 'Experts', 'Live']

export function MindPlaceApp({ compact = false }: { compact?: boolean }) {
  const world = useWorld()
  const [filter, setFilter] = useState('All')

  const courses = world.courses.filter(
    (c) => filter === 'All' || (filter === 'Courses' && c.kind === 'course') || (filter === 'Guides' && c.kind === 'guide') || (filter === 'Live' && c.kind === 'live'),
  )
  const showLearning = ['All', 'Courses', 'Guides', 'Live'].includes(filter)
  const showDiscussions = filter === 'All' || filter === 'Discussions'
  const experts = [...new Set(world.courses.map((c) => c.expertId))].map((id) => person(world, id))
  const learning = world.accountId
    ? enrollmentsOf(world, world.accountId)
        .map((e) => ({ e, c: world.courses.find((c) => c.id === e.courseId)! }))
        .filter(({ e, c }) => c && e.completed.length < c.lessons.length)
    : []

  return (
    <div className="flex flex-col gap-4 p-4 @3xl:gap-8 @3xl:px-0 @3xl:py-8">
      <SearchField placeholder="Search topics, courses, or people..." size="sm" className="@3xl:hidden" />
      <FilterPills label="MindPlace filter" options={FILTERS} value={filter} onChange={setFilter} />

      {!compact && learning.length > 0 && filter === 'All' && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Continue learning" href="/activity" action="Your learning" />
          <div className="grid gap-3 @3xl:grid-cols-2">
            {learning.map(({ e, c }) => (
              <Link key={c.id} href={`/mindplace/course/?id=${c.id}`}>
                <Card lift className="p-4">
                  <p className="font-semibold">{c.title}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-ivory">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${(e.completed.length / c.lessons.length) * 100}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {e.completed.length} of {c.lessons.length} lessons
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {showLearning && (
        <section className="flex flex-col gap-2.5 @3xl:gap-5">
          <SectionHeader title={filter === 'Live' ? 'Live sessions' : 'Featured Learning'} href="/mindplace" />
          <div className="grid grid-cols-3 gap-2 @3xl:gap-5">
            {courses.slice(0, compact ? 3 : undefined).map((c) => (
              <LearningCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}

      {filter === 'Experts' && (
        <section className="grid gap-3 @3xl:grid-cols-2">
          {experts.map((x) => (
            <Link key={x.id} href={`/people/?u=${x.username}`}>
              <Card lift className="flex items-center gap-3 p-4">
                <Avatar src={x.avatar} alt="" name={x.name} size={48} />
                <div>
                  <p className="font-semibold">{x.name}</p>
                  <p className="text-sm text-muted">{x.headline}</p>
                  <p className="text-xs text-teal-deep">{world.courses.filter((c) => c.expertId === x.id).length} courses</p>
                </div>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {showDiscussions && (
        <section className="flex flex-col @3xl:gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[0.95rem] font-semibold text-navy @3xl:text-lg">Popular Discussions</h3>
            {compact ? (
              <Link href="/mindplace" className="text-[0.7rem] font-medium text-teal-deep">
                See All →
              </Link>
            ) : (
              <Button size="sm" variant="soft" onClick={() => withAuth(() => openCreate('discussion'), 'Join PLACES to start a discussion.')}>
                + Start a discussion
              </Button>
            )}
          </div>
          <ul className="divide-y divide-line/60">
            {world.discussions.slice(0, compact ? 3 : undefined).map((d) => (
              <DiscussionRow key={d.id} d={d} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
