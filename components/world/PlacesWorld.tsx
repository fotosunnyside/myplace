'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useState } from 'react'
import type { DistrictId } from '@/lib/types'
import { AMBIENT, DISTRICTS, WORLD, pctRect, polygonPoints, type Rect } from '@/lib/world/districts'
import { cn } from '@/lib/cn'
import { DistrictLabel } from './DistrictLabel'
import { ENTER_MS, useEnterDistrict } from './useEnterDistrict'
import { CloudDrift, CornerClouds, Glints } from './Ambient'

/** Labels are padded beyond the reserved plate so hover lift never reveals it. */
const LABEL_PAD = 8
const padRect = (r: Rect, p = LABEL_PAD): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2 })
const center = (r: Rect) => `${((r.x + r.w / 2) / WORLD.width) * 100}% ${((r.y + r.h / 2) / WORLD.height) * 100}%`

interface PlacesWorldProps {
  className?: string
  /** Soft cloud bank along the bottom edge (for blending into the page). */
  foregroundClouds?: boolean
  sizes?: string
}

/**
 * The interactive PLACES world.
 *
 * Layers (bottom → top): base art · district highlight layers · ambient sprites ·
 * invisible hotspot polygons · drifting clouds · floating labels.
 * All positions are world-space (see lib/world/districts.ts) so art can be swapped.
 */
export function PlacesWorld({ className, foregroundClouds = true, sizes = '(min-width: 1024px) 76vw, 100vw' }: PlacesWorldProps) {
  const [hovered, setHovered] = useState<DistrictId | null>(null)
  const { enter, entering, prefetch } = useEnterDistrict()

  const hover = (id: DistrictId, on: boolean) => {
    setHovered((cur) => (on ? id : cur === id ? null : cur))
    if (on) prefetch(DISTRICTS.find((d) => d.id === id)!)
  }

  return (
    <div
      className={cn('relative w-full select-none overflow-hidden [container-type:inline-size]', className)}
      style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
    >
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={{ transformOrigin: entering?.origin ?? '50% 50%' }}
        animate={entering ? { scale: 2.1, filter: 'saturate(1.15) brightness(1.05)' } : { scale: 1, filter: 'saturate(1) brightness(1)' }}
        transition={{ duration: ENTER_MS / 1000, ease: [0.65, 0, 0.35, 1] }}
      >
        {/* Base artwork */}
        <Image
          src="/world/world-base.webp"
          alt="An illustrated miniature world: a hilltop academy, a cozy cottage neighborhood, a colorful market village and a modern glass work district, joined by bridges, waterfalls and bright blue water."
          fill
          fetchPriority="high"
          quality={85}
          sizes={sizes}
          className="object-cover"
          draggable={false}
        />

        {/* District highlight layers — identical pixels, brightened and glowing, faded in on hover */}
        {DISTRICTS.map((d) => (
          <div
            key={d.id}
            aria-hidden
            className="pointer-events-none absolute transition-[opacity] duration-700 ease-gentle"
            style={{
              ...pctRect(d.art.layer.rect),
              opacity: hovered === d.id ? 1 : 0,
              filter: 'brightness(1.12) saturate(1.18) drop-shadow(0 0 0.9cqw rgb(255 244 214 / 0.95))',
            }}
          >
            <Image src={d.art.layer.src} alt="" fill quality={85} sizes="40vw" className="object-fill" draggable={false} />
          </div>
        ))}

        {/* Ambient life */}
        <div aria-hidden className="pointer-events-none absolute motion-safe:animate-bob" style={pctRect(AMBIENT.balloon.rect)}>
          <Image src={AMBIENT.balloon.src} alt="" fill sizes="8vw" draggable={false} />
        </div>
        <Glints points={AMBIENT.glints} />

        {/* Hotspots */}
        <svg viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} className="absolute inset-0 h-full w-full" aria-hidden>
          {DISTRICTS.map((d) => (
            <a
              key={d.id}
              href={d.href}
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault()
                enter(d, center(d.world.label))
              }}
              onMouseEnter={() => hover(d.id, true)}
              onMouseLeave={() => hover(d.id, false)}
            >
              <polygon points={polygonPoints(d.world.hotspot)} fill="transparent" className="cursor-pointer" />
            </a>
          ))}
        </svg>

        <CloudDrift />
        {foregroundClouds && <CornerClouds />}

        {/* Labels */}
        {DISTRICTS.map((d, i) => (
          <DistrictLabel
            key={d.id}
            district={d}
            active={hovered === d.id || entering?.id === d.id}
            style={pctRect(padRect(d.world.label))}
            floatDelay={i * -1.7}
            onEnter={() => enter(d, center(d.world.label))}
            onHover={(on) => hover(d.id, on)}
          />
        ))}
      </motion.div>

      {/* Veil that completes the fly-in */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cream"
        initial={false}
        animate={{ opacity: entering ? 1 : 0 }}
        transition={{ duration: ENTER_MS / 1000, ease: [0.7, 0, 0.84, 0], delay: entering ? 0.15 : 0 }}
      />
    </div>
  )
}
