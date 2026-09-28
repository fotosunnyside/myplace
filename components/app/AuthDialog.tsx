'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { ChipPicker, ImagePicker, TextField } from '@/components/ui/fields'
import { Button } from '@/components/ui/primitives'
import { backendConfigured } from '@/lib/backend/client'
import { BackendAuthError, backendSignIn, backendSignUp } from '@/lib/backend/auth'
import { signIn, signUp } from '@/lib/store/actions'
import { getState } from '@/lib/store/store'
import { perform } from '@/lib/store/hooks'
import { closeAuth, toast, useAuthRequest, type AuthRequest } from '@/lib/ui'

const INTERESTS = ['Sustainability', 'Wellness', 'Handmade', 'Remote work', 'Design', 'Gardening', 'Travel', 'Business', 'Writing', 'Tech']

export function AuthDialog() {
  const req = useAuthRequest()
  // Keep the last request while the dialog animates out.
  const [shown, setShown] = useState<AuthRequest | null>(req)
  if (req && req !== shown) setShown(req)
  return (
    <Dialog open={!!req} onClose={closeAuth} title={shown?.mode === 'signin' ? 'Welcome back' : 'Join PLACES'} description={shown?.reason}>
      {shown && <AuthForm key={shown.mode + (shown.reason ?? '')} req={shown} />}
    </Dialog>
  )
}

function AuthForm({ req }: { req: AuthRequest }) {
  const [mode, setMode] = useState(req.mode)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [location, setLocation] = useState('')
  const [avatar, setAvatar] = useState<string>()
  const [interests, setInterests] = useState<string[]>([])
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const done = () => {
    const cb = req.onDone
    closeAuth()
    cb?.()
  }

  const local = () =>
    mode === 'join'
      ? perform((s, now) => signUp(s, { name, username, email, avatar, location, interests }, now), `Welcome to PLACES, ${name.split(' ')[0]}!`)
      : perform((s) => signIn(s, email), 'Signed in.')

  /** With the backend connected, the cloud identity comes first; the on-device account follows it. */
  const cloud = async () => {
    if (mode === 'join') {
      // Already has a place on this device (from before the cloud was connected): add the cloud identity to it.
      const existing = getState().accounts.find((a) => a.email === email.trim().toLowerCase())
      if (existing) {
        const { confirmEmail } = await backendSignUp({ email, password, name: existing.name, username: existing.username })
        const r = perform((s) => signIn(s, existing.email), 'Your place is now connected to the PLACES cloud.')
        if (r.ok && confirmEmail) toast('Check your email to confirm your account, then sign in to enter live spaces.')
        return r.ok && done()
      }
      // Check the local rules (username, email format) before creating anything in the cloud.
      try {
        signUp(getState(), { name, username, email, avatar, location, interests }, Date.now())
      } catch (e) {
        return toast((e as Error).message, 'error')
      }
      const { confirmEmail } = await backendSignUp({ email, password, name, username })
      const r = local()
      if (r.ok && confirmEmail) toast('Check your email to confirm your account, then sign in to enter live spaces.')
      return r.ok && done()
    }
    const profile = await backendSignIn(email, password)
    const known = getState().accounts.some((a) => a.email === profile.email.toLowerCase())
    const r = known
      ? perform((s) => signIn(s, profile.email), 'Signed in.')
      : // First time on this device: bring the cloud profile here.
        perform(
          (s, now) => signUp(s, { name: profile.name, username: profile.username || profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20), email: profile.email }, now),
          `Welcome back, ${profile.name.split(' ')[0]}!`,
        )
    if (r.ok) done()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!backendConfigured) {
      if (local().ok) done()
      return
    }
    setBusy(true)
    try {
      await cloud()
    } catch (err) {
      toast(err instanceof BackendAuthError ? err.message : 'We couldn’t reach PLACES. Check your connection and try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {mode === 'join' ? (
        <>
          <ImagePicker label="Profile photo (optional)" value={avatar} onChange={setAvatar} shape="round" />
          <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            hint="Lowercase letters, numbers and _ — this is your address across every Place."
            autoComplete="username"
            required
          />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          {backendConfigured && (
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} hint="At least 8 characters." required />
          )}
          <TextField label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
          <ChipPicker label="What are you into?" options={INTERESTS} value={interests} onChange={setInterests} />
        </>
      ) : (
        <>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          {backendConfigured && (
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          )}
        </>
      )}

      <Button type="submit" size="lg" className="mt-1 w-full !text-base" disabled={busy} aria-busy={busy}>
        {busy ? 'One moment…' : mode === 'join' ? 'Create my place' : 'Sign in'}
      </Button>

      {!backendConfigured && (
        <p className="rounded-2xl bg-ivory px-4 py-3 text-xs leading-relaxed text-navy-soft">
          Your account is saved privately on this device, with no password needed. We&apos;ll add syncing across devices when PLACES connects to the cloud.
        </p>
      )}

      <p className="text-center text-sm text-muted">
        {mode === 'join' ? 'Already have a place here?' : 'New to PLACES?'}{' '}
        <button type="button" onClick={() => setMode(mode === 'join' ? 'signin' : 'join')} className="font-medium text-teal-deep hover:underline">
          {mode === 'join' ? 'Sign in' : 'Join'}
        </button>
      </p>
    </form>
  )
}
