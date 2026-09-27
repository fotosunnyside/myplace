import type { ReactNode } from 'react'

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-[calc(88px+env(safe-area-inset-top))] md:pt-[112px]">
      <p className="rounded-2xl bg-sun/25 px-4 py-3 text-sm text-navy-soft">
        Draft for launch. Have a qualified lawyer review this page before PLACES handles real customers’ money or data in the cloud.
      </p>
      <h1 className="mt-8 font-serif text-5xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-8 grid gap-5 leading-relaxed text-navy-soft [&_h2]:mt-4 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-navy [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </main>
  )
}
