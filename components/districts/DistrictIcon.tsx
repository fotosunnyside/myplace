import { Briefcase, GraduationCap, House, Store, type LucideProps } from 'lucide-react'
import type { DistrictConfig } from '@/lib/world/districts'

const icons = {
  house: House,
  'graduation-cap': GraduationCap,
  store: Store,
  briefcase: Briefcase,
} satisfies Record<DistrictConfig['icon'], unknown>

export function DistrictIcon({ icon, ...props }: { icon: DistrictConfig['icon'] } & LucideProps) {
  const Icon = icons[icon]
  return <Icon aria-hidden strokeWidth={1.75} {...props} />
}
