'use client'

import Image from 'next/image'
import { BarChart3, Image as ImageIcon, Link2, MapPin, Send, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Card } from '@/components/ui/primitives'
import { createPost } from '@/lib/store/actions'
import { perform, withAuth } from '@/lib/store/hooks'
import { fileToDataUrl } from '@/lib/image'
import { openCreate, toast } from '@/lib/ui'

/** Quick post composer. Link, poll and location open the full post form. */
export function Composer() {
  const [body, setBody] = useState('')
  const [image, setImage] = useState<string>()
  const file = useRef<HTMLInputElement>(null)

  const submit = () =>
    withAuth(() => {
      if (perform((s, now) => createPost(s, { body, image }, now), 'Posted.').ok) {
        setBody('')
        setImage(undefined)
      }
    }, 'Join PLACES to share posts.')

  const actions = [
    { label: 'Photo', icon: ImageIcon },
    { label: 'Link', icon: Link2 },
    { label: 'Poll', icon: BarChart3 },
    { label: 'Location', icon: MapPin },
  ]
  const onAction = (label: string) => (label === 'Photo' ? file.current?.click() : withAuth(() => openCreate('post')))

  return (
    <Card className="p-2.5 @3xl:p-5">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Write a post</span>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={2000}
            className="h-8 w-full rounded-full bg-ivory/80 px-3 text-[0.62rem] text-navy outline-none placeholder:text-muted focus:bg-white focus:ring-2 focus:ring-teal/20 @3xl:h-12 @3xl:px-5 @3xl:text-[0.95rem]"
          />
        </label>
        <button aria-label="Post" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal text-white transition hover:bg-teal-deep @3xl:h-10 @3xl:w-10">
          <Send className="h-3 w-3 @3xl:h-4 @3xl:w-4" />
        </button>
      </form>
      {image && (
        <div className="relative mt-3 aspect-[16/9] overflow-hidden rounded-xl">
          <Image src={image} alt="Photo to post" fill unoptimized className="object-cover" />
          <button onClick={() => setImage(undefined)} aria-label="Remove photo" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 @3xl:mt-4 @3xl:gap-6">
        {actions.map(({ label, icon: Icon }) => (
          <button key={label} type="button" onClick={() => onAction(label)} className="inline-flex items-center gap-1 text-[0.55rem] font-medium text-navy-soft hover:text-teal-deep @3xl:gap-2 @3xl:text-sm">
            <Icon className="h-3 w-3 text-teal @3xl:h-[18px] @3xl:w-[18px]" />
            {label}
          </button>
        ))}
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            setImage(await fileToDataUrl(f))
          } catch (err) {
            toast((err as Error).message, 'error')
          }
        }}
      />
    </Card>
  )
}
