// PLACES · link-preview
//
// Reads a web page's title, description and image so posts can show a preview of the links in them.
// Browsers can't read other sites directly, so this small function does it, bounded (5 s, 512 KB, public
// addresses only) and cached in public.link_previews for a week.
//
// Deploy:  supabase functions deploy link-preview --no-verify-jwt   (the CI migrate job does this)
// Call:    POST { "url": "https://…" }  →  { title, description, image, siteName, url } or 204 when there's nothing to show.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { checkUrl, fetchPreview } from '../_shared/link-preview.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const json = (body: unknown, status = 200) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let raw = ''
  try {
    raw = String((await req.json())?.url ?? '')
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const url = checkUrl(raw)
  if (!url) return json({ error: 'unsupported_url' }, 400)
  const key = url.toString()

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: cached } = await db.from('link_previews').select('*').eq('url', key).maybeSingle()
  if (cached && Date.now() - Date.parse(cached.fetched_at) < WEEK_MS) {
    return cached.title ? json({ url: cached.final_url ?? key, title: cached.title, description: cached.description, image: cached.image, siteName: cached.site_name }) : json(null, 204)
  }

  const preview = await fetchPreview(key).catch(() => null)
  await db.from('link_previews').upsert({
    url: key,
    final_url: preview?.url ?? null,
    title: preview?.title ?? null,
    description: preview?.description ?? null,
    image: preview?.image ?? null,
    site_name: preview?.siteName ?? null,
    fetched_at: new Date().toISOString(),
  })
  return preview ? json(preview) : json(null, 204)
})
