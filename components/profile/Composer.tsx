'use client'

import { BarChart3, Image as ImageIcon, Link2, MapPin, Mic } from 'lucide-react'
import { Card } from '@/components/ui/primitives'

const actions = [
  { label: 'Photo', icon: ImageIcon },
  { label: 'Link', icon: Link2 },
  { label: 'Poll', icon: BarChart3 },
  { label: 'Location', icon: MapPin },
]

export function Composer() {
  return (
    <Card className="p-2.5 @3xl:p-5">
      <label className="flex items-center gap-2">
        <span className="sr-only">Write a post</span>
        <input
          placeholder="What's on your mind?"
          className="h-8 min-w-0 flex-1 rounded-full bg-ivory/80 px-3 text-[0.62rem] text-navy outline-none placeholder:text-muted focus:bg-white focus:ring-2 focus:ring-teal/20 @3xl:h-12 @3xl:px-5 @3xl:text-[0.95rem]"
        />
        <button aria-label="Voice post" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal text-white @3xl:h-10 @3xl:w-10">
          <Mic className="h-3 w-3 @3xl:h-5 @3xl:w-5" />
        </button>
      </label>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 @3xl:mt-4 @3xl:gap-6">
        {actions.map(({ label, icon: Icon }) => (
          <button key={label} className="inline-flex items-center gap-1 text-[0.55rem] font-medium text-navy-soft hover:text-teal-deep @3xl:gap-2 @3xl:text-sm">
            <Icon className="h-3 w-3 text-teal @3xl:h-[18px] @3xl:w-[18px]" />
            {label}
          </button>
        ))}
      </div>
    </Card>
  )
}
