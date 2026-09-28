'use client'

import { ProfileView } from '@/components/profile/ProfileView'
import { LiveSpacesSection } from '@/components/spaces/LiveSpacesSection'
import { useWorld } from '@/lib/store/hooks'
import { me, person } from '@/lib/store/selectors'

/** Your home in PLACES. Guests see an example home until they join. */
export function YourPlaceApp({ compact = false }: { compact?: boolean }) {
  const world = useWorld()
  const account = me(world)
  const p = account ?? person(world, 'p_josie')
  if (compact) return <ProfileView key={p.id} p={p} own={!!account} preview={!account} compact />
  return (
    <>
      <LiveSpacesSection className="mb-8 mt-6 @3xl:mb-10 @3xl:mt-10" />
      <ProfileView key={p.id} p={p} own={!!account} preview={!account} />
    </>
  )
}
