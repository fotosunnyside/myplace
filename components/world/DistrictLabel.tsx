'use client'

import type { CSSProperties } from 'react'
import type { DistrictConfig } from '@/lib/world/districts'
import { cn } from '@/lib/cn'

interface DistrictLabelProps {
  district: DistrictConfig
  active: boolean
  style: CSSProperties
  /** "full" shows the caps tagline (desktop), "pill" is name only (phone). */
  variant?: 'full' | 'pill'
  floatDelay?: number
  onEnter: () => void
  onHover: (on: boolean) => void
}

/**
 * Floating cream label anchored to a district. Sizes are expressed in container-query
 * units of the world stage so the label scales with the artwork and always covers
 * the label plate area reserved in the art.
 */
export function DistrictLabel({ district, active, style, variant = 'full', floatDelay = 0, onEnter, onHover }: DistrictLabelProps) {
  const full = variant === 'full'
  return (
    <div className="pointer-events-none absolute z-20" style={style}>
      <div className="h-full w-full motion-safe:animate-[labelFloat_7s_ease-in-out_infinite]" style={{ animationDelay: `${floatDelay}s` }}>
        <a
          href={district.href}
          onClick={(e) => {
            e.preventDefault()
            onEnter()
          }}
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
          onFocus={() => onHover(true)}
          onBlur={() => onHover(false)}
          aria-label={`Enter ${district.name} — ${district.labelTagline}`}
          data-active={active}
          className={cn(
            'group pointer-events-auto relative flex h-full w-full flex-col items-center justify-center border border-white/80 bg-cream/95 text-navy shadow-label',
            'transition-[transform,box-shadow,background-color] duration-500 ease-gentle',
            'data-[active=true]:-translate-y-[5px] data-[active=true]:scale-[1.045] data-[active=true]:bg-white data-[active=true]:shadow-[0_4px_10px_rgb(18_59_74/0.08),0_24px_44px_-14px_rgb(18_59_74/0.45),0_0_0_4px_rgb(255_255_255/0.35)]',
            full ? 'rounded-[1.6cqw]' : 'rounded-full',
          )}
        >
          <span
            className="font-serif font-medium leading-none tracking-[-0.01em]"
            style={{ fontSize: full ? '2.45cqw' : '5.4cqw' }}
          >
            {district.name}
          </span>
          {full && (
            <span
              className="mt-[0.6cqw] hidden whitespace-nowrap font-sans font-medium uppercase leading-none text-navy-soft @[900px]:block"
              style={{ fontSize: 'max(0.7cqw, 6.5px)', letterSpacing: '0.22em' }}
            >
              {district.labelTagline}
            </span>
          )}
        </a>
      </div>
    </div>
  )
}
