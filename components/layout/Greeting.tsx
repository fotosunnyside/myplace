'use client'

import { Button } from '@/components/ui/primitives'
import { useHydrated, useMe, useNow } from '@/lib/store/hooks'
import { openAuth } from '@/lib/ui'

const partOfDay = (ts: number) => {
  const h = new Date(ts).getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function Greeting() {
  const me = useMe()
  const ready = useHydrated()
  const now = useNow()
  if (!ready) return <div className="h-[4.5rem]" />
  if (!me)
    return (
      <div>
        <p className="font-serif text-[1.7rem] leading-tight text-navy">Welcome to PLACES</p>
        <p className="mt-1 font-serif text-[0.95rem] italic text-navy-soft">A global community to live, learn, create and work — together.</p>
        <Button className="mt-4 w-full" size="lg" onClick={() => openAuth({ mode: 'join' })}>
          Join PLACES — it’s free
        </Button>
      </div>
    )
  return (
    <div>
      <p className="font-serif text-[1.7rem] leading-tight text-navy" suppressHydrationWarning>
        {partOfDay(now)}, <span className="italic">{me.name.split(' ')[0]}</span>
      </p>
      <p className="mt-1 font-serif text-[0.95rem] italic text-navy-soft">A global community to live, learn, create and work — together.</p>
    </div>
  )
}
