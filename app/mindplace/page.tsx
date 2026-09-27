import type { Metadata } from 'next'
import { DistrictPage } from '@/components/districts/DistrictPage'
import { getDistrict } from '@/lib/world/districts'

const district = getDistrict('mindplace')

export const metadata: Metadata = { title: 'MindPlace', description: district.description }

export default function MindPlacePage() {
  return <DistrictPage id="mindplace" />
}
