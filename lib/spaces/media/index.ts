import { DeviceMediaProvider } from './device'
import type { MediaProvider } from './types'

export * from './types'

/**
 * ── THE PROVIDER INTEGRATION POINT (browser side) ────────────────────────────
 *
 * Live multi-person video/audio needs a dedicated WebRTC provider. None is connected yet, so rooms
 * use DeviceMediaProvider: your own camera and mic work, presence is live, and the room tells people
 * that video between participants isn't on yet.
 *
 * To connect a provider:
 *  1. Add `lib/spaces/media/<provider>.ts` implementing `MediaProvider` with that vendor's SDK
 *     (`needsToken: true`, `carriesRemoteMedia: true`). Keep every vendor call inside that file.
 *  2. Register it below and set NEXT_PUBLIC_MEDIA_PROVIDER=<provider> (a name, not a secret).
 *  3. Implement token minting for it in supabase/functions/virtual-space-token (secrets live only there).
 */
const providers: Record<string, () => MediaProvider> = {
  device: () => new DeviceMediaProvider(),
}

export const MEDIA_PROVIDER = process.env.NEXT_PUBLIC_MEDIA_PROVIDER ?? 'device'

export function createMediaProvider(): MediaProvider {
  return (providers[MEDIA_PROVIDER] ?? providers.device)()
}
