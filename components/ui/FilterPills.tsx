'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

interface FilterPillsProps {
  options: string[]
  value?: string
  onChange?: (value: string) => void
  className?: string
  label: string
}

/** Horizontally scrollable, pill-shaped segmented filter. Works controlled or uncontrolled. */
export function FilterPills({ options, value, onChange, className, label }: FilterPillsProps) {
  const [internal, setInternal] = useState(options[0])
  const active = value ?? internal

  return (
    <div role="tablist" aria-label={label} className={cn('scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5', className)}>
      {options.map((opt) => {
        const on = opt === active
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={on}
            onClick={() => {
              setInternal(opt)
              onChange?.(opt)
            }}
            className={cn(
              'h-7 shrink-0 rounded-full border px-3.5 text-[0.7rem] font-medium transition duration-300 ease-gentle @3xl:h-9 @3xl:px-5 @3xl:text-sm',
              on
                ? 'border-teal bg-teal text-white shadow-[0_6px_14px_-8px_rgb(18_170_168/0.9)]'
                : 'border-line bg-white/80 text-navy-soft hover:border-teal/30 hover:text-navy',
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
