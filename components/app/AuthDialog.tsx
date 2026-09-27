'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { ChipPicker, ImagePicker, TextField } from '@/components/ui/fields'
import { Button } from '@/components/ui/primitives'
import { signIn, signUp } from '@/lib/store/actions'
import { perform } from '@/lib/store/hooks'
import { closeAuth, useAuthRequest, type AuthRequest } from '@/lib/ui'

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

  const done = () => {
    const cb = req.onDone
    closeAuth()
    cb?.()
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const r =
      mode === 'join'
        ? perform((s, now) => signUp(s, { name, username, email, avatar, location, interests }, now), `Welcome to PLACES, ${name.split(' ')[0]}!`)
        : perform((s) => signIn(s, email), 'Signed in.')
    if (r.ok) done()
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
          <TextField label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
          <ChipPicker label="What are you into?" options={INTERESTS} value={interests} onChange={setInterests} />
        </>
      ) : (
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      )}

      <Button type="submit" size="lg" className="mt-1 w-full !text-base">
        {mode === 'join' ? 'Create my place' : 'Sign in'}
      </Button>

      <p className="rounded-2xl bg-ivory px-4 py-3 text-xs leading-relaxed text-navy-soft">
        Your account is saved privately on this device, with no password needed. We&apos;ll add syncing across devices when PLACES connects to the cloud.
      </p>

      <p className="text-center text-sm text-muted">
        {mode === 'join' ? 'Already have a place here?' : 'New to PLACES?'}{' '}
        <button type="button" onClick={() => setMode(mode === 'join' ? 'signin' : 'join')} className="font-medium text-teal-deep hover:underline">
          {mode === 'join' ? 'Sign in' : 'Join'}
        </button>
      </p>
    </form>
  )
}
