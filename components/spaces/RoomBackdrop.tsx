'use client'

import { useEffect, useRef, useState } from 'react'
import { Picture } from '@/components/ui/Picture'
import { roomBackground } from '@/lib/spaces/rooms'
import type { VirtualSpace } from '@/lib/spaces/types'
import { withBase } from '@/lib/base-path'
import { cn } from '@/lib/cn'

type BackdropSpace = Pick<VirtualSpace, 'backgroundStyle' | 'backgroundUrl' | 'roomType' | 'focusX' | 'focusY' | 'name'>

/**
 * The place itself: the room's background filling the space behind everyone.
 *
 * Crops around the admin's focal point when the image and screen are close in shape. When they're
 * far apart (a wide panorama on a tall phone), it shows a tall band of the image around the focal
 * point, feathered into a blurred extension of itself, instead of cutting most of it away.
 */
export function RoomBackdrop({
  space,
  className,
  priority = false,
  dim = true,
  fit: fitMode = 'auto',
}: {
  space: BackdropSpace
  className?: string
  priority?: boolean
  dim?: boolean
  /** 'cover' for small tiles (cards, thumbnails); 'auto' for rooms. */
  fit?: 'auto' | 'cover'
}) {
  const bg = roomBackground(space)
  const box = useRef<HTMLDivElement>(null)
  const [boxAspect, setBoxAspect] = useState<number | null>(null)
  const [imgAspect, setImgAspect] = useState<number | null>(null)
  const src = bg.kind === 'image' ? bg.src : ''
  const [loadedFor, setLoadedFor] = useState('')
  if (loadedFor !== src) {
    setLoadedFor(src)
    setImgAspect(null)
  }

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBoxAspect(e.contentRect.width / Math.max(1, e.contentRect.height)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ratio = boxAspect && imgAspect ? imgAspect / boxAspect : 1
  const fit = fitMode === 'auto' && (ratio > 1.9 || ratio < 0.52) ? 'band' : 'cover'
  // A panorama on a tall screen: show a generous band of it (still cropped at the sides, around the
  // focal point), feathered into a blurred extension of the same image above and below.
  const band = fit === 'band' && boxAspect && imgAspect ? Math.min(100, Math.max((boxAspect / imgAspect) * 100, ratio > 1 ? 50 : 100)) : 100
  const local = src.startsWith('/')

  return (
    <div ref={box} className={cn('absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#cfeef7_0%,#e9f6f3_55%,#fff9ef_100%)]', className)} aria-hidden>
      {bg.kind === 'none' ? (
        <>
          <div className="absolute inset-x-0 top-0 h-2/5 opacity-70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBase('/world/clouds.webp')} alt="" className="h-full w-full object-cover" draggable={false} />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_110%,rgb(94_158_104/0.18),transparent_60%)]" />
        </>
      ) : (
        <>
          {fit === 'band' && (
            <Picture src={src} alt="" fill sizes="40vw" unoptimized={!local} className="scale-125 object-cover opacity-90 blur-2xl saturate-[1.1]" style={{ objectPosition: `${bg.focusX}% ${bg.focusY}%` }} />
          )}
          <div
            className="absolute inset-x-0"
            style={
              fit === 'band'
                ? {
                    height: `${band}%`,
                    top: `${(100 - band) * (bg.focusY / 100)}%`,
                    maskImage: 'linear-gradient(180deg, transparent, #000 14%, #000 86%, transparent)',
                    WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 14%, #000 86%, transparent)',
                  }
                : { top: 0, bottom: 0 }
            }
          >
            <Picture
              key={src}
              src={src}
              alt=""
              fill
              priority={priority}
              sizes="100vw"
              unoptimized={!local}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img.naturalWidth) setImgAspect(img.naturalWidth / img.naturalHeight)
              }}
              className={cn('object-cover transition-opacity duration-700', imgAspect ? 'opacity-100' : 'opacity-0')}
              style={{ objectPosition: `${bg.focusX}% ${bg.focusY}%` }}
            />
          </div>
        </>
      )}
      {/* Keeps names and controls readable on any image without flattening the place. */}
      {dim && <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(18_59_74/0.28)_0%,transparent_22%,transparent_70%,rgb(18_59_74/0.38)_100%)]" />}
    </div>
  )
}
