'use client'

import Link from 'next/link'
import { Loader2, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Shell } from '@/components/detail/Shell'
import { Button, Card } from '@/components/ui/primitives'
import { useAdminStatus, useBackendSession } from '@/lib/backend/auth'
import { backendConfigured } from '@/lib/backend/client'
import { useHydrated, useMe } from '@/lib/store/hooks'
import { openAuth } from '@/lib/ui'

/**
 * Admin pages render only for people the database recognizes as PLACES admins (public.is_admin()).
 * This gate is for the interface; the database enforces the same rule on every write.
 */
export function AdminGate({ children, title, back }: { children: ReactNode; title: string; back?: { href: string; label: string } }) {
  const ready = useHydrated()
  const me = useMe()
  const session = useBackendSession()
  const admin = useAdminStatus()

  let body: ReactNode = null
  if (!backendConfigured) {
    body = (
      <Notice title="Admin needs the PLACES backend">
        <p>
          Room settings are stored in Supabase and protected by its admin rules, so managing them isn’t available in this on-device preview. Connect the backend
          (<code className="rounded bg-ivory px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-ivory px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>),
          then make yourself an admin — see README → Virtual Spaces.
        </p>
      </Notice>
    )
  } else if (!ready || session.status === 'loading' || (session.status === 'signed-in' && admin === 'checking')) {
    body = (
      <div className="grid h-64 place-items-center" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-teal" />
      </div>
    )
  } else if (session.status !== 'signed-in' || !me) {
    body = (
      <Notice title="Sign in to continue">
        <p>The admin area is for PLACES operators.</p>
        <Button className="mt-5" onClick={() => openAuth({ mode: 'signin' })}>
          Sign in
        </Button>
      </Notice>
    )
  } else if (admin !== 'admin') {
    body = (
      <Notice title="This area is for PLACES admins">
        <p>Your account doesn’t have admin access.</p>
        <Link href="/" className="mt-5 inline-block font-medium text-teal-deep hover:underline">
          Back to the world
        </Link>
      </Notice>
    )
  }

  return (
    <Shell back={back} width="max-w-5xl">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-navy text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-muted">PLACES Admin</p>
          <h1 className="font-serif text-[2.2rem] leading-tight">{title}</h1>
        </div>
      </div>
      {body ?? children}
    </Shell>
  )
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="px-6 py-10 text-center md:px-12">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mx-auto mt-2 max-w-lg text-navy-soft">{children}</div>
    </Card>
  )
}
