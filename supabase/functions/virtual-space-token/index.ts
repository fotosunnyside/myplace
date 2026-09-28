// PLACES · virtual-space-token
//
// Issues a short-lived token for the live video/audio provider, so the browser
// never holds a provider secret. The caller must be signed in to PLACES and must
// currently hold a place in the room (granted atomically, capacity-checked, by
// `join_virtual_space`). Publish rights come from the room's configuration.
//
// Deploy:   supabase functions deploy virtual-space-token
// Secrets:  supabase secrets set MEDIA_PROVIDER=<name> MEDIA_API_KEY=... MEDIA_API_SECRET=... MEDIA_SERVER_URL=...
//
// Until a provider is chosen this answers 501 `media_provider_not_configured`, and
// PLACES keeps rooms running with presence and on-device camera/mic preview.

import { createClient } from 'npm:@supabase/supabase-js@2'

const TOKEN_TTL_SECONDS = 60 * 10

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

export interface MediaGrant {
  spaceId: string
  userId: string
  displayName: string
  canPublishVideo: boolean
  canPublishAudio: boolean
  role: 'participant' | 'speaker' | 'moderator'
  ttlSeconds: number
}

export interface MintedToken {
  provider: string
  token: string
  serverUrl?: string
  expiresAt: string
}

/**
 * ── THE PROVIDER INTEGRATION POINT (server side) ─────────────────────────────
 * Add one entry per media provider. Each receives an already-authorized grant
 * and returns that provider's room token, signed with secrets that exist only
 * in this function's environment. Map `grant.spaceId` to the provider's room
 * name (overflow rooms have their own ids, so they get their own media rooms).
 */
const providers: Record<string, (grant: MediaGrant) => Promise<MintedToken>> = {
  // example: async (grant) => ({ provider: 'example', token: await sign(grant, Deno.env.get('MEDIA_API_SECRET')!), serverUrl: Deno.env.get('MEDIA_SERVER_URL'), expiresAt: ... }),
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'not_signed_in' }, 401)

  let spaceId: unknown
  try {
    spaceId = (await req.json())?.space_id
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (typeof spaceId !== 'string' || !/^[0-9a-f-]{36}$/.test(spaceId)) return json({ error: 'bad_request' }, 400)

  // Runs as the caller, so every check below is the database's own RLS / grant logic.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })

  const { data: user, error: userError } = await supabase.auth.getUser()
  if (userError || !user.user) return json({ error: 'not_signed_in' }, 401)

  const { data, error } = await supabase.rpc('virtual_space_media_grant', { p_space_id: spaceId }).maybeSingle<{
    space_id: string
    user_id: string
    display_name: string
    can_publish_video: boolean
    can_publish_audio: boolean
    role: MediaGrant['role']
  }>()
  if (error) return json({ error: 'grant_failed' }, 500)
  if (!data) return json({ error: 'not_in_room' }, 403)

  const name = Deno.env.get('MEDIA_PROVIDER') ?? ''
  const mint = providers[name]
  if (!mint) return json({ error: 'media_provider_not_configured' }, 501)

  const grant: MediaGrant = {
    spaceId: data.space_id,
    userId: data.user_id,
    displayName: data.display_name,
    canPublishVideo: data.can_publish_video,
    canPublishAudio: data.can_publish_audio,
    role: data.role,
    ttlSeconds: TOKEN_TTL_SECONDS,
  }
  try {
    return json(await mint(grant))
  } catch (e) {
    console.error('virtual-space-token: provider error', e)
    return json({ error: 'provider_error' }, 502)
  }
})
