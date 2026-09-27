'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useState } from 'react'
import type { DistrictId } from '@/lib/types'
import { DISTRICTS, MOBILE_WORLD, pctRect, type Point, type Rect } from '@/lib/world/districts'
import { DistrictLabel } from './DistrictLabel'
import { CloudDrift, Glints } from './Ambient'
import { ENTER_MS, useEnterDistrict } from './useEnterDistrict'
import { withBase } from '@/lib/base-path'

const pad = (r: Rect, p = 4): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2 })
const center = (r: Rect) =>
  `${((r.x + r.w / 2) / MOBILE_WORLD.width) * 100}% ${((r.y + r.h / 2) / MOBILE_WORLD.height) * 100}%`

const GLINTS: Point[] = [[20, 140], [30, 250], [212, 238], [190, 300], [18, 330], [226, 150]]

/**
 * Vertical world for phones. The landscape is authored as a tall composition so
 * districts reveal themselves as you scroll: MindPlace → YourPlace → MarketPlace → WorkPlace.
 */
export function MobileWorld() {
  const { enter, entering } = useEnterDistrict()
  const [pressed, setPressed] = useState<DistrictId | null>(null)

  return (
    <div
      className="relative w-full overflow-hidden [container-type:inline-size]"
      style={{ aspectRatio: `${MOBILE_WORLD.width} / ${MOBILE_WORLD.height}` }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: entering?.origin ?? '50% 50%' }}
        animate={entering ? { scale: 1.9 } : { scale: 1 }}
        transition={{ duration: ENTER_MS / 1000, ease: [0.65, 0, 0.35, 1] }}
      >
        <Image
          src="/world/mobile-world.webp"
          alt="An illustrated vertical world with an academy on the hilltop, a cottage neighborhood, a market village and a glass work district by the sea."
          fill
          fetchPriority="high"
          quality={85}
          sizes="100vw"
          className="object-cover"
          draggable={false}
        />
        <Glints points={GLINTS} space={MOBILE_WORLD} />
        <CloudDrift className="top-[-1%] h-[10%]" opacity={0.55} />

        {/* Whole-band tap targets behind the labels */}
        {DISTRICTS.map((d) => (
          <a
            key={d.id}
            href={withBase(d.href)}
            tabIndex={-1}
            aria-hidden
            onClick={(e) => {
              e.preventDefault()
              enter(d, center(d.mobile.label))
            }}
            onTouchStart={() => setPressed(d.id)}
            onTouchEnd={() => setPressed(null)}
            className="absolute inset-x-0"
            style={{ top: `${(d.mobile.band.y / MOBILE_WORLD.height) * 100}%`, height: `${(d.mobile.band.h / MOBILE_WORLD.height) * 100}%` }}
          />
        ))}

        {DISTRICTS.map((d, i) => (
          <DistrictLabel
            key={d.id}
            district={d}
            variant="pill"
            active={pressed === d.id || entering?.id === d.id}
            style={pctRect(pad(d.mobile.label), MOBILE_WORLD)}
            floatDelay={i * -1.3}
            onEnter={() => enter(d, center(d.mobile.label))}
            onHover={() => {}}
          />
        ))}
      </motion.div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cream"
        initial={false}
        animate={{ opacity: entering ? 1 : 0 }}
        transition={{ duration: ENTER_MS / 1000, delay: entering ? 0.15 : 0 }}
      />
    </div>
  )
}
