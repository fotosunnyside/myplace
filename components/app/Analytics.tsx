import Script from 'next/script'

/**
 * Privacy-friendly analytics, off by default.
 * Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN (e.g. "fotosunnyside.github.io") at build time to enable Plausible.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  if (!domain) return null
  return <Script defer data-domain={domain} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
}
