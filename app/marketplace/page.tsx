import type { Metadata } from 'next'
import { DistrictPage } from '@/components/districts/DistrictPage'
import { getDistrict } from '@/lib/world/districts'

const district = getDistrict('marketplace')

export const metadata: Metadata = { title: 'MarketPlace', description: district.description }

export default function MarketPlacePage() {
  return <DistrictPage id="marketplace" />
}
