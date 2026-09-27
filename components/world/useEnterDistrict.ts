'use client'

import { useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import { useCallback, useState } from 'react'
import type { DistrictConfig } from '@/lib/world/districts'

/** Duration of the "fly into the district" transition before navigation. */
export const ENTER_MS = 650

/**
 * Handles the zoom-into-district transition, then navigates.
 * `origin` is the point (in % of the stage) the camera should fly towards.
 */
export function useEnterDistrict() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [entering, setEntering] = useState<{ id: string; origin: string } | null>(null)

  const enter = useCallback(
    (d: DistrictConfig, origin: string) => {
      if (entering) return
      if (reduce) return router.push(d.href)
      setEntering({ id: d.id, origin })
      router.prefetch(d.href)
      window.setTimeout(() => router.push(d.href), ENTER_MS - 80)
    },
    [entering, reduce, router],
  )

  return { enter, entering, prefetch: (d: DistrictConfig) => router.prefetch(d.href) }
}
