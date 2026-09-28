'use client'

import { backendSignOut } from '@/lib/backend/auth'
import { roomSession } from './live'

/** Signing out also gives back your place in any room, then ends the cloud session. Call before the local sign-out. */
export async function leaveRoomAndSignOut() {
  await roomSession.leave()
  await backendSignOut()
}
