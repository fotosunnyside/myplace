'use client'

import { getSupabase } from '@/lib/backend/client'
import { backendSignOut } from '@/lib/backend/auth'
import { roomSession } from '@/lib/spaces/live'
import { removeMyMedia } from './cloud/driver'
import { settled } from './cloud/sync'
import { getState, getWorldMode } from './store'

/**
 * Deletes the member's account in the shared world: their photos, then (in the database) their account and
 * everything they made. Call before the local deleteAccount action.
 */
export async function deleteCloudAccount() {
  const me = getState().accountId
  if (getWorldMode() !== 'cloud' || !me) return
  await settled()
  await roomSession.leave()
  await removeMyMedia(me).catch(() => {})
  const sb = await getSupabase()
  const { error } = await sb.rpc('delete_my_account')
  if (error) throw new Error('We couldn’t delete your account. Please try again.')
  await backendSignOut()
}
