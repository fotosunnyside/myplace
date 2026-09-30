'use client'

import { useEffect, useState } from 'react'
import { backendConfigured, getSupabase } from '@/lib/backend/client'
import { firstUrl, type LinkPreview } from '@/supabase/functions/_shared/link-preview'

export { firstUrl, type LinkPreview }

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const cache = new Map<string, Promise<LinkPreview | null>>()

type Row = { final_url: string | null; title: string | null; description: string | null; image: string | null; site_name: string | null; fetched_at: string }

async function load(url: string): Promise<LinkPreview | null> {
  if (!backendConfigured) return null
  const sb = await getSupabase()
  // Someone already looked this site up: read it straight from the shared cache.
  const { data: row } = await sb.from('link_previews').select('final_url, title, description, image, site_name, fetched_at').eq('url', url).maybeSingle<Row>()
  if (row && Date.now() - Date.parse(row.fetched_at) < WEEK_MS) {
    return row.title ? { url: row.final_url ?? url, title: row.title, description: row.description ?? '', image: row.image, siteName: row.site_name ?? '' } : null
  }
  const { data, error } = await sb.functions.invoke<LinkPreview>('link-preview', { body: { url } })
  return error || !data?.title ? null : data
}

/** A page's title, description and image, or null while loading / when there's nothing to show (then a plain link card appears). */
export function useLinkPreview(url: string | undefined) {
  const [preview, setPreview] = useState<{ url: string; data: LinkPreview | null } | null>(null)
  useEffect(() => {
    if (!url) return
    let live = true
    let p = cache.get(url)
    if (!p) {
      p = load(url).catch(() => null)
      cache.set(url, p)
    }
    p.then((data) => live && setPreview({ url, data }))
    return () => {
      live = false
    }
  }, [url])
  return preview && preview.url === url ? preview.data : null
}
