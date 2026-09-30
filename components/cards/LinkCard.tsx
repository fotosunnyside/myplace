'use client'

import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useLinkPreview } from '@/lib/linkPreview'
import { cn } from '@/lib/cn'

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** A post's link: the site's own title, description and image when we can read them, a tidy link card otherwise. */
export function LinkCard({ url, className }: { url: string; className?: string }) {
  const preview = useLinkPreview(url)
  const [imageOk, setImageOk] = useState(true)
  const site = preview?.siteName || host(url)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className={cn('group block overflow-hidden rounded-xl border border-line/80 bg-white transition hover:border-teal/40 @3xl:rounded-2xl', className)}
      data-testid="link-card"
    >
      {preview?.image && imageOk && (
        <span className="block aspect-[1.91/1] overflow-hidden bg-ivory">
          {/* eslint-disable-next-line @next/next/no-img-element -- any site's image, shown as-is */}
          <img src={preview.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageOk(false)} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
        </span>
      )}
      <span className="flex items-start gap-3 p-3 @3xl:p-4">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.55rem] font-medium uppercase tracking-[0.14em] text-muted @3xl:text-[0.7rem]">{site}</span>
          <span className="mt-0.5 line-clamp-2 block text-[0.66rem] font-semibold leading-snug text-navy @3xl:text-[0.95rem]">{preview?.title || url.replace(/^https?:\/\//, '')}</span>
          {preview?.description && <span className="mt-1 line-clamp-2 hidden text-sm leading-snug text-navy-soft @3xl:block">{preview.description}</span>}
        </span>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted @3xl:h-4 @3xl:w-4" aria-hidden />
      </span>
    </a>
  )
}

const URL_RE = /(\bhttps?:\/\/[^\s<>"']+)/gi

/** Post text with its web addresses clickable. */
export function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) => {
        if (i % 2 === 0) return part
        const clean = part.replace(/[),.!?;:'"\]]+$/, '')
        return (
          <span key={i}>
            <a href={clean} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all text-teal-deep hover:underline">
              {clean.replace(/^https?:\/\//, '')}
            </a>
            {part.slice(clean.length)}
          </span>
        )
      })}
    </>
  )
}
