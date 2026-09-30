import { describe, expect, it } from 'vitest'
import { checkUrl, fetchPreview, firstUrl, parsePreview } from '@/supabase/functions/_shared/link-preview'
import * as A from '@/lib/store/actions'
import { seedWorld } from '@/lib/store/seed'

const page = `<!doctype html><html><head>
  <title>Fallback title</title>
  <meta property="og:title" content="Slow Living &amp; Small Joys">
  <meta name="description" content="Ignored when og:description exists">
  <meta property='og:description' content='Notes on a gentler life.'>
  <meta property="og:image" content="/img/cover.jpg">
  <meta property="og:site_name" content="The Gentle Journal">
</head><body>…</body></html>`

describe('link previews', () => {
  it('reads Open Graph tags, making images absolute', () => {
    expect(parsePreview(page, 'https://journal.example.com/post/1')).toEqual({
      url: 'https://journal.example.com/post/1',
      title: 'Slow Living & Small Joys',
      description: 'Notes on a gentler life.',
      image: 'https://journal.example.com/img/cover.jpg',
      siteName: 'The Gentle Journal',
    })
  })

  it('falls back to the page title and the site name from the address', () => {
    const p = parsePreview('<html><head><title> Hello  world </title><meta property="og:image" content="javascript:alert(1)"></head></html>', 'https://www.example.org/x')
    expect(p).toMatchObject({ title: 'Hello world', siteName: 'example.org', description: '', image: null })
  })

  it('only fetches ordinary public web addresses', () => {
    for (const bad of ['ftp://example.com', 'http://localhost:3000', 'http://127.0.0.1', 'http://10.0.0.5/admin', 'http://192.168.1.1', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'https://user:pw@example.com', 'https://example.com:8443/', 'https://intranet.corp/', 'http://printer.local', 'not a url'])
      expect(checkUrl(bad), bad).toBeNull()
    expect(checkUrl('https://example.com/a?b=1#frag')?.toString()).toBe('https://example.com/a?b=1')
  })

  it('finds the first web address in a post, without trailing punctuation', () => {
    expect(firstUrl('Loved this (https://example.com/read?x=1). So good!')).toBe('https://example.com/read?x=1')
    expect(firstUrl('no links here')).toBeNull()
  })

  it('follows safe redirects but never into a private address', async () => {
    const html = new TextEncoder().encode(page)
    const fake = (async (url: string) => {
      if (url === 'https://short.example/a') return new Response(null, { status: 301, headers: { location: 'https://journal.example.com/post/1' } })
      if (url === 'https://short.example/evil') return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } })
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }) as unknown as typeof fetch
    expect((await fetchPreview('https://short.example/a', fake))?.title).toBe('Slow Living & Small Joys')
    expect(await fetchPreview('https://short.example/evil', fake)).toBeNull()
    const pdf = (async () => new Response('x', { headers: { 'content-type': 'application/pdf' } })) as unknown as typeof fetch
    expect(await fetchPreview('https://example.com/file.pdf', pdf)).toBeNull()
  })

  it('turns a web address typed into a post into its link', () => {
    let s = A.signUp(seedWorld(0), { name: 'Link Tester', username: 'linktester', email: 'l@example.com' }, 0)
    s = A.createPost(s, { body: 'Read this https://example.com/story' }, 0)
    expect(s.posts[0]).toMatchObject({ body: 'Read this https://example.com/story', link: 'https://example.com/story' })
  })
})
