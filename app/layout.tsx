import type { Metadata, Viewport } from 'next'
import { DM_Sans, Newsreader } from 'next/font/google'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { MobileTabBar, MobileTopBar } from '@/components/layout/MobileChrome'
import { AppProviders } from '@/components/app/AppProviders'
import { Analytics } from '@/components/app/Analytics'
import { SiteFooter } from '@/components/layout/SiteFooter'
import './globals.css'

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const description =
  'PLACES FOR US turns the internet into an explorable world: YourPlace, MindPlace, MarketPlace and WorkPlace — one identity, four Places, one connected world.'

export const metadata: Metadata = {
  // Origin only: Next adds the base path to metadata URLs itself.
  metadataBase: new URL(new URL(siteUrl).origin),
  openGraph: { type: 'website', siteName: 'PLACES FOR US', title: 'PLACES FOR US — The internet, made into a world.', description },
  twitter: { card: 'summary_large_image', title: 'PLACES FOR US — The internet, made into a world.', description },
  title: {
    default: 'PLACES FOR US — The internet, made into a world.',
    template: '%s · PLACES FOR US',
  },
  description,
  applicationName: 'PLACES FOR US',
  appleWebApp: { capable: true, title: 'PLACES FOR US', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFF9EF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${dmSans.variable}`}>
      <body className="min-h-dvh overflow-x-hidden">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift"
        >
          Skip to content
        </a>
        <SiteHeader />
        <MobileTopBar />
        <div id="content">{children}</div>
        <SiteFooter />
        <MobileTabBar />
        <AppProviders />
        <Analytics />
      </body>
    </html>
  )
}
