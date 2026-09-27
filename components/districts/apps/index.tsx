import type { ComponentType } from 'react'
import type { DistrictId } from '@/lib/types'
import { MarketPlaceApp } from './MarketPlaceApp'
import { MindPlaceApp } from './MindPlaceApp'
import { WorkPlaceApp } from './WorkPlaceApp'
import { YourPlaceApp } from './YourPlaceApp'

/** Each district's interface. Responsive to its container: a compact preview or a full page. */
export const DISTRICT_APPS: Record<DistrictId, ComponentType<{ compact?: boolean }>> = {
  yourplace: YourPlaceApp,
  mindplace: MindPlaceApp,
  marketplace: MarketPlaceApp,
  workplace: WorkPlaceApp,
}
