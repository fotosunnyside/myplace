/**
 * Base path the site is served under (e.g. "/myplace" on GitHub Pages, "" locally).
 * next/link and the router add it automatically; use `withBase` for raw URLs
 * (plain <a>/<img>/<form>, manifest entries).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const withBase = (path: string) => (path.startsWith('/') ? `${BASE_PATH}${path}` : path)
