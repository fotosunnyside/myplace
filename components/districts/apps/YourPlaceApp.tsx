'use client'

import { ProfileView } from '@/components/profile/ProfileView'
import { useWorld } from '@/lib/store/hooks'
import { me, person } from '@/lib/store/selectors'

/** Your home in PLACES. Guests see an example home until they join. */
export function YourPlaceApp({ compact = false }: { compact?: boolean }) {
  const world = useWorld()
  const account = me(world)
  const p = account ?? person(world, 'p_josie')
  if (compact) return <ProfileView key={p.id} p={p} own={!!account} preview={!account} compact />
  return <ProfileView key={p.id} p={p} own={!!account} preview={!account} home />
}
