import type { Point } from '@/lib/world/districts'
import { WORLD } from '@/lib/world/districts'

/** Slow, barely-there clouds drifting across the top of the sky. */
export function CloudDrift({ className = 'top-[-2%] h-[24%]', opacity = 0.5 }: { className?: string; opacity?: number }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 overflow-hidden ${className}`} style={{ opacity }}>
      <div className="flex h-full w-[200%] motion-safe:animate-drift">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/world/clouds.webp" alt="" className="h-full w-1/2 object-cover" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/world/clouds.webp" alt="" className="h-full w-1/2 object-cover" draggable={false} />
      </div>
    </div>
  )
}

/** Cloud banks in the lower corners that let the world dissolve into the page. */
export function CornerClouds() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-[-3%] h-[26%] overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to right, #000 0%, #000 18%, transparent 36%, transparent 70%, #000 86%)',
        WebkitMaskImage: 'linear-gradient(to right, #000 0%, #000 18%, transparent 36%, transparent 70%, #000 86%)',
      }}
    >
      <div className="flex h-full w-[200%] motion-safe:animate-drift-slow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/world/foreground.webp" alt="" className="h-full w-1/2 object-cover object-bottom" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/world/foreground.webp" alt="" className="h-full w-1/2 object-cover object-bottom" draggable={false} />
      </div>
    </div>
  )
}

/** Tiny sun glints on the water. */
export function Glints({ points, space = WORLD }: { points: Point[]; space?: { width: number; height: number } }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {points.map(([x, y], i) => (
        <span
          key={i}
          className="absolute block opacity-0 motion-safe:animate-glint"
          style={{
            left: `${(x / space.width) * 100}%`,
            top: `${(y / space.height) * 100}%`,
            width: '1.1cqw',
            height: '1.1cqw',
            marginLeft: '-0.55cqw',
            marginTop: '-0.55cqw',
            animationDelay: `${(i * 1.37) % 5.5}s`,
            background:
              'radial-gradient(circle, rgb(255 255 255 / 0.95) 0 12%, rgb(255 255 255 / 0.35) 30%, transparent 62%), conic-gradient(from 45deg, transparent 0 20%, rgb(255 255 255 / 0.6) 25%, transparent 30% 45%, rgb(255 255 255 / 0.6) 50%, transparent 55% 70%, rgb(255 255 255 / 0.6) 75%, transparent 80% 95%, rgb(255 255 255 / 0.6) 100%)',
            borderRadius: '50%',
          }}
        />
      ))}
    </div>
  )
}
