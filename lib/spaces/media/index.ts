import { DeviceMediaProvider } from './device'
import { P2PMediaProvider } from './p2p'
import type { MediaProvider } from './types'

export * from './types'

/**
 * ── THE PROVIDER INTEGRATION POINT (browser side) ────────────────────────────
 *
 * Rooms use P2PMediaProvider by default: people near each other in a room connect browser to browser
 * (WebRTC), introduced through the room's signal channel. It suits small conversations (a mesh of up to
 * MAX_CONNECTIONS people). For large rooms or recording, connect a media service (SFU) instead:
 *  1. Add `lib/spaces/media/<provider>.ts` implementing `MediaProvider` with that vendor's SDK
 *     (`needsToken: true`, `carriesRemoteMedia: true`). Keep every vendor call inside that file.
 *  2. Register it below and set NEXT_PUBLIC_MEDIA_PROVIDER=<provider> (a name, not a secret).
 *  3. Implement token minting for it in supabase/functions/virtual-space-token (secrets live only there).
 * NEXT_PUBLIC_MEDIA_PROVIDER=device keeps media on each person's own device.
 */
const providers: Record<string, () => MediaProvider> = {
  p2p: () => new P2PMediaProvider(),
  device: () => new DeviceMediaProvider(),
}

export const MEDIA_PROVIDER = process.env.NEXT_PUBLIC_MEDIA_PROVIDER || 'p2p'

export function createMediaProvider(): MediaProvider {
  return (providers[MEDIA_PROVIDER] ?? providers.p2p)()
}
