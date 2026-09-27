import type { Metadata, Viewport } from 'next'
import { DM_Sans, Newsreader } from 'next/font/google'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { MobileTabBar, MobileTopBar } from '@/components/layout/MobileChrome'
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

export const metadata: Metadata = {
  title: {
    default: 'PLACES — The internet, made into a world.',
    template: '%s · PLACES',
  },
  description:
    'PLACES turns the internet into an explorable world: YourPlace, MindPlace, MarketPlace and WorkPlace — one identity, four Places, one connected world.',
  applicationName: 'PLACES',
  appleWebApp: { capable: true, title: 'PLACES', statusBarStyle: 'default' },
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
        <MobileTabBar />
      </body>
    </html>
  )
}
