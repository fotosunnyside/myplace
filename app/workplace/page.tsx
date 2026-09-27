import type { Metadata } from 'next'
import { DistrictPage } from '@/components/districts/DistrictPage'
import { getDistrict } from '@/lib/world/districts'

const district = getDistrict('workplace')

export const metadata: Metadata = { title: 'WorkPlace', description: district.description }

export default function WorkPlacePage() {
  return <DistrictPage id="workplace" />
}
