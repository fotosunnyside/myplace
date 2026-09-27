import Link from 'next/link'
import { LogoMark } from '@/components/brand/Logo'

const links = [
  { label: 'Explore', href: '/explore' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-line/70 bg-ivory px-6 pb-[calc(88px+env(safe-area-inset-bottom))] pt-8 md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted md:flex-row">
        <p className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" /> PLACES · The Conscious Web
        </p>
        <nav aria-label="Footer" className="flex gap-6">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-navy">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
