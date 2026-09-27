import Image from 'next/image'
import type { DistrictConfig } from '@/lib/world/districts'
import { cn } from '@/lib/cn'

interface DistrictBannerProps {
  district: DistrictConfig
  className?: string
  priority?: boolean
  sizes?: string
  /** Render the title as the page heading. */
  asHeading?: boolean
}

/** Illustrated district header with its floating title card. Scales as one unit (container units). */
export function DistrictBanner({ district, className, priority, sizes = '(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw', asHeading }: DistrictBannerProps) {
  const t = district.art.bannerTitle
  const Title = asHeading ? 'h1' : 'h2'
  const left = t.align === 'left'

  return (
    <div className={cn('relative w-full overflow-hidden [container-type:inline-size]', className)} style={{ aspectRatio: district.art.bannerAspect }}>
      <Image src={district.art.banner} alt="" fill priority={priority} quality={85} sizes={sizes} className="object-cover" />

      {left && (
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-[70%]"
          style={{ background: 'radial-gradient(60% 70% at 32% 44%, rgb(255 249 239 / 0.72), rgb(255 249 239 / 0.35) 55%, transparent 80%)' }}
        />
      )}

      <div
        className={cn(
          'absolute flex flex-col justify-center',
          left ? 'items-start' : 'items-center rounded-[3.2cqw] border border-white/70 bg-cream/95 text-center shadow-label',
        )}
        style={{ left: `${t.left}%`, top: `${t.top}%`, width: `${t.width}%`, height: `${t.height}%` }}
      >
        <Title className="font-serif font-medium leading-none tracking-[-0.015em] text-navy" style={{ fontSize: left ? '7.4cqw' : '6.6cqw' }}>
          {district.name}
        </Title>
        <p
          className={cn('font-sans leading-none', left ? 'text-navy-soft' : 'text-teal-deep')}
          style={{ fontSize: '2.9cqw', marginTop: '1.6cqw', letterSpacing: '0.02em' }}
        >
          {district.subtitle}
        </p>
      </div>
    </div>
  )
}
