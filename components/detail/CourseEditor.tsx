'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ImagePicker, Select, TextArea, TextField } from '@/components/ui/fields'
import { Button, ButtonLink, Card } from '@/components/ui/primitives'
import { createCourse, hasCreatorPlan, updateCourse, type CourseInput, type LessonInput } from '@/lib/store/actions'
import { perform, useHydrated, useWorld } from '@/lib/store/hooks'
import { withBase } from '@/lib/base-path'
import type { Course } from '@/lib/types'
import { cn } from '@/lib/cn'
import { Shell } from './Shell'

const TOPICS = ['Sustainability', 'Wellness', 'Careers', 'Business', 'Creativity', 'Design', 'Tech', 'Languages', 'Cooking', 'Other']

export function CourseEditor() {
  const id = useSearchParams().get('id')
  const world = useWorld()
  const ready = useHydrated()
  const course = id ? world.courses.find((c) => c.id === id) : undefined

  if (!ready) return <Shell width="max-w-3xl">{null}</Shell>
  if (!hasCreatorPlan(world))
    return (
      <Shell width="max-w-3xl" back={{ href: '/teach', label: 'Teach on PLACES' }}>
        <Card className="p-10 text-center">
          <p className="font-serif text-3xl">Start your creator plan first</p>
          <p className="mt-2 text-muted">Publishing courses is part of the creator plan.</p>
          <ButtonLink href="/teach" className="mt-6">
            See the plan
          </ButtonLink>
        </Card>
      </Shell>
    )
  if (id && (!course || course.expertId !== world.accountId))
    return (
      <Shell width="max-w-3xl" back={{ href: '/teach', label: 'Your courses' }}>
        <Card className="p-10 text-center">You can only edit your own courses.</Card>
      </Shell>
    )
  return <EditorForm key={course?.id ?? 'new'} course={course} />
}

const blankLesson = (): LessonInput => ({ title: '', minutes: 5, body: '' })

function EditorForm({ course }: { course?: Course }) {
  const router = useRouter()
  const [f, setF] = useState({
    title: course?.title ?? '',
    subtitle: course?.subtitle ?? '',
    description: course?.description ?? '',
    topic: course?.topic ?? TOPICS[0],
    kind: (course?.kind === 'guide' ? 'guide' : 'course') as CourseInput['kind'],
    stripeLink: course?.stripeLink ?? '',
  })
  const [image, setImage] = useState<string | undefined>(course?.image)
  const [paid, setPaid] = useState(!!course?.price)
  const [price, setPrice] = useState(course?.price ? String(course.price / 100) : '')
  const [lessons, setLessons] = useState<LessonInput[]>(course?.lessons.map((l) => ({ ...l })) ?? [blankLesson()])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const setLesson = (i: number, patch: Partial<LessonInput>) => setLessons(lessons.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...lessons]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setLessons(next)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input: CourseInput = {
      ...f,
      image: image ?? '',
      price: paid ? Math.round(parseFloat(price.replace(/[^0-9.]/g, '') || '0') * 100) : 0,
      stripeLink: paid ? f.stripeLink : '',
      lessons,
    }
    if (course) {
      if (perform((s) => updateCourse(s, course.id, input), 'Course saved.').ok) router.push(`/mindplace/course/?id=${course.id}`)
    } else {
      const r = perform((s, now) => createCourse(s, input, now), 'Your course is live in MindPlace!')
      if (r.ok) router.push(`/mindplace/course/?id=${r.id}`)
    }
  }

  const returnUrl = course && typeof window !== 'undefined' ? `${window.location.origin}${withBase(`/mindplace/course/?id=${course.id}&paid=1`)}` : ''

  return (
    <Shell width="max-w-3xl" back={{ href: '/teach', label: 'Your courses' }}>
      <h1 className="font-serif text-4xl">{course ? 'Edit course' : 'New course'}</h1>
      <form onSubmit={submit} className="mt-6 grid gap-6">
        <Card className="grid gap-5 p-6">
          <h2 className="text-lg font-semibold">About the course</h2>
          <ImagePicker label="Cover image" value={image} onChange={setImage} />
          <TextField label="Title" value={f.title} onChange={set('title')} maxLength={80} required placeholder="e.g. Watercolor for Beginners" />
          <TextField label="Short tagline" value={f.subtitle} onChange={set('subtitle')} maxLength={60} placeholder="e.g. Paint your first landscape" />
          <TextArea label="Description" value={f.description} onChange={set('description')} rows={3} maxLength={1500} placeholder="What will people learn? Who is it for?" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Topic" options={TOPICS} value={f.topic} onChange={set('topic')} />
            <Select label="Format" options={['course', 'guide']} value={f.kind} onChange={set('kind')} />
          </div>
        </Card>

        <Card className="grid gap-5 p-6">
          <h2 className="text-lg font-semibold">Price</h2>
          <div role="radiogroup" aria-label="Price" className="grid grid-cols-2 gap-3">
            {[
              { v: false, label: 'Free', hint: 'Anyone can learn' },
              { v: true, label: 'Paid', hint: 'Learners buy access' },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={paid === o.v}
                onClick={() => setPaid(o.v)}
                className={cn('rounded-2xl border p-4 text-left transition', paid === o.v ? 'border-teal bg-teal-wash/60' : 'border-line bg-white hover:border-teal/40')}
              >
                <span className="block font-semibold">{o.label}</span>
                <span className="text-sm text-muted">{o.hint}</span>
              </button>
            ))}
          </div>
          {paid && (
            <>
              <TextField label="Price (USD)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="29.00" required />
              <TextField
                label="Stripe Payment Link"
                type="url"
                value={f.stripeLink}
                onChange={set('stripeLink')}
                placeholder="https://buy.stripe.com/…"
                hint={
                  <>
                    Create a Payment Link for this course in your Stripe Dashboard and paste it here, so learners pay you directly.
                    {returnUrl ? <> Set its confirmation page to redirect to: <span className="break-all font-mono">{returnUrl}</span></> : ' After saving, you’ll see the confirmation URL to use in Stripe.'} Without a link, purchases are test purchases.
                  </>
                }
              />
            </>
          )}
        </Card>

        <Card className="grid gap-4 p-6">
          <h2 className="text-lg font-semibold">Lessons</h2>
          {lessons.map((l, i) => (
            <fieldset key={i} className="grid gap-3 rounded-2xl border border-line/80 bg-ivory/50 p-4">
              <legend className="sr-only">Lesson {i + 1}</legend>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-teal-deep">Lesson {i + 1}</span>
                <span className="flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="rounded-full p-1.5 hover:bg-navy/5 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" disabled={i === lessons.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="rounded-full p-1.5 hover:bg-navy/5 disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" disabled={lessons.length === 1} onClick={() => setLessons(lessons.filter((_, j) => j !== i))} aria-label="Remove lesson" className="rounded-full p-1.5 hover:bg-navy/5 hover:text-coral disabled:opacity-30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <TextField label="Lesson title" value={l.title} onChange={(e) => setLesson(i, { title: e.target.value })} maxLength={80} />
                <TextField label="Minutes" type="number" min={1} max={240} value={l.minutes} onChange={(e) => setLesson(i, { minutes: Number(e.target.value) })} />
              </div>
              <TextArea label="Lesson content" value={l.body} onChange={(e) => setLesson(i, { body: e.target.value })} rows={5} maxLength={10000} placeholder="Write the lesson. Short paragraphs work best." />
            </fieldset>
          ))}
          <Button type="button" variant="soft" onClick={() => setLessons([...lessons, blankLesson()])} className="justify-self-start">
            <Plus className="h-4 w-4" /> Add lesson
          </Button>
        </Card>

        <Button type="submit" size="lg" className="!text-base">
          {course ? 'Save changes' : 'Publish course'}
        </Button>
      </form>
    </Shell>
  )
}
