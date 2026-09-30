// Link previews for posts: reads a web page's title, description and image (Open Graph / Twitter tags).
//
// Plain TypeScript with no Deno or Node APIs, so the edge function and the unit tests share it.

export interface LinkPreview {
  url: string
  title: string
  description: string
  image: string | null
  siteName: string
}

/** Only ordinary public web addresses: no local, private or internal hosts (the function must never reach those). */
export function checkUrl(raw: string): URL | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username || u.password) return null
  if (u.port && u.port !== '80' && u.port !== '443') return null
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host.includes('.') || host === 'localhost' || /\.(local|internal|localhost|lan|home|corp)$/.test(host)) return null
  // IP literals: refuse loopback, private, link-local and other special ranges.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null
  }
  if (host.includes(':')) return null // IPv6 literals: not needed for public sites
  u.hash = ''
  return u
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim()

/** Every <meta> tag's attributes. */
function metas(html: string): Record<string, string>[] {
  const out: Record<string, string>[] = []
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {}
    for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? ''
    out.push(attrs)
  }
  return out
}

/** Builds a preview from a page's HTML. `pageUrl` is where the page was actually served from (after redirects). */
export function parsePreview(html: string, pageUrl: string): LinkPreview {
  const head = html.slice(0, 200_000)
  const tags = metas(head)
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const t = tags.find((m) => (m.property ?? m.name ?? '').toLowerCase() === k && m.content)
      if (t) return decode(t.content)
    }
    return ''
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''
  const host = new URL(pageUrl).hostname.replace(/^www\./, '')
  let image: string | null = pick('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src') || null
  if (image) {
    try {
      const abs = new URL(image, pageUrl)
      image = abs.protocol === 'https:' || abs.protocol === 'http:' ? abs.toString() : null
    } catch {
      image = null
    }
  }
  return {
    url: pageUrl,
    title: (pick('og:title', 'twitter:title') || decode(titleTag) || host).slice(0, 200),
    description: pick('og:description', 'twitter:description', 'description').slice(0, 300),
    image: image && image.length <= 2048 ? image : null,
    siteName: (pick('og:site_name', 'application-name') || host).slice(0, 80),
  }
}

/** The first web address in some text (what a post links to). */
export function firstUrl(text: string): string | null {
  const m = text.match(/\bhttps?:\/\/[^\s<>"']+/i)
  if (!m) return null
  return m[0].replace(/[),.!?;:'"\]]+$/, '')
}

/**
 * Fetches a page and reads its preview. Small and bounded on purpose: 5 seconds, 512 KB of HTML,
 * at most 3 redirects, each one checked again so a public link can't bounce to a private address.
 */
export async function fetchPreview(raw: string, fetchImpl: typeof fetch = fetch): Promise<LinkPreview | null> {
  let url = checkUrl(raw)
  for (let hop = 0; url && hop <= 3; hop++) {
    const res = await fetchImpl(url.toString(), {
      redirect: 'manual',
      headers: { 'user-agent': 'PLACES-link-preview/1.0 (+https://placesforus.com)', accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location')
      url = next ? checkUrl(new URL(next, url).toString()) : null
      continue
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null
    const reader = res.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < 512 * 1024) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      size += value.length
    }
    reader.cancel().catch(() => {})
    const bytes = new Uint8Array(size)
    let at = 0
    for (const c of chunks) {
      bytes.set(c.subarray(0, Math.min(c.length, size - at)), at)
      at += c.length
    }
    return parsePreview(new TextDecoder().decode(bytes), url.toString())
  }
  return null
}
