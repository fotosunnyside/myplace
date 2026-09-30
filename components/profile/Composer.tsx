'use client'

import Image from 'next/image'
import { BarChart3, Image as ImageIcon, Loader2, MapPin, Send, Video, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LinkCard } from '@/components/cards/LinkCard'
import { firstUrl } from '@/lib/linkPreview'
import { Card } from '@/components/ui/primitives'
import { createPost } from '@/lib/store/actions'
import { perform, withAuth } from '@/lib/store/hooks'
import { fileToDataUrl } from '@/lib/image'
import { prepareVideo, VIDEO_TYPES } from '@/lib/video'
import { openCreate, toast } from '@/lib/ui'

/** Quick post composer. Link, poll and location open the full post form. */
export function Composer() {
  const [body, setBody] = useState('')
  const [image, setImage] = useState<string>()
  const [video, setVideo] = useState<string>()
  const [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const videoFile = useRef<HTMLInputElement>(null)
  // Paste a link and its preview appears (once you pause typing, so we don't look up half an address).
  const [link, setLink] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setLink(firstUrl(body)), 600)
    return () => clearTimeout(t)
  }, [body])

  const submit = () =>
    withAuth(() => {
      if (uploading) return toast('Your video is still uploading — one moment.')
      if (perform((s, now) => createPost(s, { body, image, video }, now), 'Posted.').ok) {
        setBody('')
        setImage(undefined)
        setVideo(undefined)
      }
    }, 'Join PLACES FOR US to share posts.')

  const actions = [
    { label: 'Photo', icon: ImageIcon },
    { label: 'Video', icon: Video },
    { label: 'Poll', icon: BarChart3 },
    { label: 'Location', icon: MapPin },
  ]
  const onAction = (label: string) =>
    label === 'Photo'
      ? file.current?.click()
      : label === 'Video'
        ? withAuth(() => videoFile.current?.click(), 'Join PLACES FOR US to share videos.')
        : withAuth(() => openCreate('post'))

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
            placeholder="What's on your mind? Paste a link to share it."
            maxLength={2000}
            className="h-8 w-full rounded-full bg-ivory/80 px-3 text-[0.62rem] text-navy outline-none placeholder:text-muted focus:bg-white focus:ring-2 focus:ring-teal/20 @3xl:h-12 @3xl:px-5 @3xl:text-[0.95rem]"
          />
        </label>
        <button aria-label="Post" disabled={uploading} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal text-white transition hover:bg-teal-deep @3xl:h-10 @3xl:w-10">
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
      {uploading && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-ivory px-3 py-2 text-xs text-navy-soft @3xl:text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-teal" /> Uploading your video…
        </p>
      )}
      {link && !image && !video && <LinkCard url={link} className="mt-3" />}
      {video && (
        <div className="relative mt-3 overflow-hidden rounded-xl bg-ivory">
          <video src={video} controls playsInline preload="metadata" className="mx-auto block h-auto max-h-[60vh] w-auto max-w-full" aria-label="Video to post" />
          <button onClick={() => setVideo(undefined)} aria-label="Remove video" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90">
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
      <input
        ref={videoFile}
        type="file"
        accept={VIDEO_TYPES.join(',')}
        aria-label="Choose a video"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setUploading(true)
          try {
            setVideo(await prepareVideo(f))
          } catch (err) {
            toast((err as Error).message, 'error')
          } finally {
            setUploading(false)
          }
        }}
      />
    </Card>
  )
}
