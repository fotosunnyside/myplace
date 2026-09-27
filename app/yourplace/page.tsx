import type { Metadata } from 'next'
import { DistrictPage } from '@/components/districts/DistrictPage'
import { getDistrict } from '@/lib/world/districts'

const district = getDistrict('yourplace')

export const metadata: Metadata = { title: 'YourPlace', description: district.description }

export default function YourPlacePage() {
  return <DistrictPage id="yourplace" />
}
