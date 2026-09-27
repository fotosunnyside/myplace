import Link from 'next/link'
import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn('shrink-0', className)}>
      <path d="M3 15 20 3v19z" fill="#58C8C6" />
      <path d="M37 15 20 3v19z" fill="#12AAA8" />
      <path d="M3 15 20 22v16z" fill="#5E9E68" />
      <path d="M37 15 20 22v16z" fill="#123B4A" opacity=".9" />
      <path d="M20 3v35" stroke="#FFF9EF" strokeOpacity=".55" strokeWidth=".8" />
    </svg>
  )
}

interface LogoProps {
  className?: string
  /** "stacked" is the centered phone variant. */
  variant?: 'inline' | 'stacked'
  href?: string
}

export function Logo({ className, variant = 'inline', href = '/' }: LogoProps) {
  const stacked = variant === 'stacked'
  return (
    <Link
      href={href}
      aria-label="PLACES — home"
      className={cn('group inline-flex items-center gap-2.5 text-navy', stacked && 'flex-col gap-0', className)}
    >
      {!stacked && <LogoMark className="h-9 w-9 transition-transform duration-500 ease-gentle group-hover:-rotate-6" />}
      <span className={cn('flex flex-col leading-none', stacked && 'items-center')}>
        <span
          className={cn(
            'font-serif font-semibold tracking-[0.06em]',
            stacked ? 'text-[1.6rem]' : 'text-[1.9rem]',
          )}
        >
          PLACES
        </span>
        <span
          className={cn(
            'mt-1 font-sans font-medium uppercase text-navy-soft',
            stacked ? 'text-[0.45rem] tracking-[0.32em]' : 'text-[0.55rem] tracking-[0.34em]',
          )}
        >
          The Conscious Web
        </span>
      </span>
    </Link>
  )
}
