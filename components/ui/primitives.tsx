import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/* ------------------------------------------------------------------ */
/* Card                                                                 */
/* ------------------------------------------------------------------ */

export function Card({ className, lift = false, ...props }: ComponentProps<'div'> & { lift?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-card border border-line/80 bg-white/80 shadow-soft',
        lift && 'transition duration-500 ease-gentle hover:-translate-y-0.5 hover:shadow-lift',
        className,
      )}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition duration-300 ease-gentle active:scale-[0.98] disabled:opacity-50'

const buttonVariants = {
  primary:
    'bg-teal text-white shadow-[0_10px_24px_-10px_rgb(18_170_168/0.7)] hover:bg-teal-deep hover:shadow-[0_14px_30px_-10px_rgb(18_170_168/0.8)]',
  soft: 'bg-teal-wash text-teal-deep hover:bg-[#d3eeeb]',
  ghost: 'text-navy hover:bg-navy/5',
  outline: 'border border-line bg-white/70 text-navy hover:border-teal/40 hover:bg-white',
}

const buttonSizes = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-14 px-8 text-lg',
}

type ButtonStyle = { variant?: keyof typeof buttonVariants; size?: keyof typeof buttonSizes }

export function Button({ variant = 'primary', size = 'md', className, ...props }: ComponentProps<'button'> & ButtonStyle) {
  return <button className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props} />
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props} />
}

/* ------------------------------------------------------------------ */
/* Avatar                                                               */
/* ------------------------------------------------------------------ */

export function Avatar({
  src,
  alt,
  size = 40,
  ring = false,
  className,
}: {
  src: string
  alt: string
  size?: number
  ring?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative inline-block shrink-0 overflow-hidden rounded-full bg-sand',
        ring && 'ring-2 ring-white shadow-soft',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={alt} fill sizes={`${size * 2}px`} className="object-cover" />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Section header                                                       */
/* ------------------------------------------------------------------ */

export function SectionHeader({
  title,
  href = '#',
  action = 'See All',
  className,
}: {
  title: ReactNode
  href?: string
  action?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <h3 className="text-[0.95rem] font-semibold text-navy @3xl:text-lg">{title}</h3>
      <Link
        href={href}
        className="group inline-flex items-center gap-1 text-[0.7rem] font-medium text-teal-deep hover:text-teal @3xl:text-xs"
      >
        {action}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tag                                                                  */
/* ------------------------------------------------------------------ */

const tones = {
  teal: 'bg-teal-wash text-teal-deep',
  coral: 'bg-[#fdebe6] text-[#c9634d]',
  sun: 'bg-[#fdf2d6] text-[#a8791a]',
  lavender: 'bg-[#efeaf8] text-[#7560a6]',
  leaf: 'bg-[#e6f1e7] text-[#3f7a4a]',
  sky: 'bg-[#e4f4fa] text-[#2f7f98]',
  neutral: 'bg-ivory text-navy-soft',
} as const

export type Tone = keyof typeof tones

export function Tag({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export const toneBg: Record<Tone, string> = tones
