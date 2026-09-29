/**
 * Guests (anonymous sessions) against a real Supabase stack: they may drop into rooms open to guests and do
 * nothing else. Needs anonymous sign-ins on (supabase/config.toml). Skipped when the test variables aren't set.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_TEST_URL ?? ''
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY ?? ''
const enabled = Boolean(URL && ANON && SERVICE)
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const run = `${Date.now()}`

describe.skipIf(!enabled)('guests (Supabase)', () => {
  let service: SupabaseClient
  let guest: SupabaseClient
  let guestId = ''
  const room = async (slug: string) => (await service.from('virtual_spaces').select('id').eq('slug', slug).single()).data!.id as string

  beforeAll(async () => {
    service = createClient(URL, SERVICE, opts)
    guest = createClient(URL, ANON, opts)
    const { data, error } = await guest.auth.signInAnonymously({ options: { data: { name: 'Sky Guest' } } })
    if (error) throw error
    guestId = data.user!.id
  })

  afterAll(async () => {
    if (!enabled) return
    await service.from('virtual_space_participants').delete().eq('user_id', guestId)
    await service.auth.admin.deleteUser(guestId)
  })

  it('opens the Accountability Department to guests, and keeps Town Hall for members', async () => {
    expect((await service.from('virtual_spaces').select('visibility').eq('slug', 'accountability-room').single()).data).toEqual({ visibility: 'public' })
    const joined = await guest.rpc('join_virtual_space', { p_space_id: await room('accountability-room') })
    expect(joined.error).toBeNull()
    expect(joined.data).toMatchObject({ user_id: guestId, display_name: 'Sky Guest' })
    expect((await guest.rpc('join_virtual_space', { p_space_id: await room('town-hall') })).error?.code).toBe('PLC03')
    await guest.rpc('leave_virtual_space', { p_space_id: await room('accountability-room') })
  })

  it('gives a guest no profile, so they can’t write anything in the world', async () => {
    expect((await service.from('profiles').select('id').eq('id', guestId)).data).toEqual([])
    expect((await guest.from('posts').insert({ id: `post_g${run}`, author_id: guestId, body: 'hi' })).error).not.toBeNull()
    expect((await guest.from('member_plans').insert({ user_id: guestId, kind: 'host', status: 'active', via: 'test', renews_at: new Date(Date.now() + 86_400_000).toISOString() })).error).not.toBeNull()
    const upload = await guest.storage.from('media').upload(`${guestId}/x.png`, new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }))
    expect(upload.error).not.toBeNull()
  })

  it('keeps websites on profiles to real links', async () => {
    const { data } = await service.from('profiles').select('id').not('user_id', 'is', null).limit(1).single()
    const id = data!.id as string
    expect((await service.from('profiles').update({ website: 'javascript:alert(1)' }).eq('id', id)).error).not.toBeNull()
    expect((await service.from('profiles').update({ website: 'https://mystudio.com' }).eq('id', id)).error).toBeNull()
    await service.from('profiles').update({ website: null }).eq('id', id)
  })
})
