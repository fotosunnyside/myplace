/**
 * Virtual Places, together: moving your circle, room chat and the introductions between browsers for
 * person-to-person video, against a real Supabase stack. Only people in the room take part; nobody
 * can read someone else's introductions. Skipped without SUPABASE_TEST_* variables.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_TEST_URL ?? ''
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY ?? ''
const enabled = Boolean(URL && ANON && SERVICE)
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const run = `${Date.now()}`

describe.skipIf(!enabled)('rooms together (Supabase)', () => {
  let service: SupabaseClient
  let room = ''
  const people: { client: SupabaseClient; id: string }[] = []

  async function user(label: string) {
    const email = `${label}-together-${run}@places.test`
    const created = await service.auth.admin.createUser({ email, password: 'correct-horse-battery', email_confirm: true, user_metadata: { name: label } })
    if (created.error) throw created.error
    const client = createClient(URL, ANON, opts)
    const { error } = await client.auth.signInWithPassword({ email, password: 'correct-horse-battery' })
    if (error) throw error
    return { client, id: created.data.user.id }
  }

  beforeAll(async () => {
    service = createClient(URL, SERVICE, opts)
    for (const n of ['Ada', 'Ben', 'Outsider']) people.push(await user(n))
    const { data } = await service
      .from('virtual_spaces')
      .insert({ name: `Together ${run}`, slug: `together-${run}`, description: '', room_type: 'meeting', visibility: 'members', max_participants: 12, created_by: null, settings: {} })
      .select('id')
      .single()
      .throwOnError()
    room = data!.id
    for (const p of people.slice(0, 2)) await p.client.rpc('join_virtual_space', { p_space_id: room, p_display_name: 'Someone' }).throwOnError()
  })

  afterAll(async () => {
    if (!enabled) return
    if (room) await service.from('virtual_spaces').delete().eq('id', room)
    for (const p of people) await service.auth.admin.deleteUser(p.id)
  })

  const [ada, ben, outsider] = [0, 1, 2].map((i) => () => people[i])

  it('moves only your own circle, kept inside the room', async () => {
    const { data } = await ada().client.rpc('move_in_virtual_space', { p_space_id: room, p_x: 1.7, p_y: 0.25 })
    expect(data).toBe(true)
    const roster = (await ben().client.rpc('virtual_space_roster', { p_space_id: room })).data as { user_id: string; pos_x: number; pos_y: number }[]
    expect(roster.find((r) => r.user_id === ada().id)).toMatchObject({ pos_x: 1, pos_y: 0.25 })
    // Someone outside the room can't place themselves in it.
    expect((await outsider().client.rpc('move_in_virtual_space', { p_space_id: room, p_x: 0.5, p_y: 0.5 })).data).toBe(false)
    // And nobody writes positions directly.
    await ben().client.from('virtual_space_participants').update({ pos_x: 0 }).eq('user_id', ada().id)
    const after = (await ben().client.rpc('virtual_space_roster', { p_space_id: room })).data as { user_id: string; pos_x: number }[]
    expect(after.find((r) => r.user_id === ada().id)?.pos_x).toBe(1)
  })

  it('lets people in the room chat — and only them', async () => {
    const sent = await ada().client.rpc('send_virtual_space_message', { p_space_id: room, p_body: '  Hello room  ' })
    expect(sent.error).toBeNull()
    expect(sent.data).toMatchObject({ body: 'Hello room', display_name: 'Someone', user_id: ada().id })

    const seen = await ben().client.from('virtual_space_messages').select('body').eq('space_id', room)
    expect(seen.data?.map((m) => m.body)).toContain('Hello room')

    // Outside the room: can't read, can't post, can't forge a message directly.
    expect((await outsider().client.from('virtual_space_messages').select('body').eq('space_id', room)).data).toEqual([])
    expect((await outsider().client.rpc('send_virtual_space_message', { p_space_id: room, p_body: 'hi' })).error?.code).toBe('42501')
    const forged = await ben().client.from('virtual_space_messages').insert({ space_id: room, user_id: ada().id, display_name: 'Ada', body: 'forged' })
    expect(forged.error).not.toBeNull()
    expect((await ada().client.rpc('send_virtual_space_message', { p_space_id: room, p_body: '   ' })).error).not.toBeNull()
  })

  it('passes introductions only between people in the same room, readable only by the recipient', async () => {
    const offer = { type: 'offer', sdp: 'v=0' }
    expect((await ada().client.rpc('send_virtual_space_signal', { p_space_id: room, p_to: ben().id, p_kind: 'offer', p_payload: offer })).error).toBeNull()

    const mine = await ben().client.from('virtual_space_signals').select('from_user, kind, payload').eq('space_id', room)
    expect(mine.data).toEqual([{ from_user: ada().id, kind: 'offer', payload: offer }])
    // The sender (and anyone else) can't read it.
    expect((await ada().client.from('virtual_space_signals').select('id').eq('space_id', room)).data).toEqual([])
    expect((await outsider().client.from('virtual_space_signals').select('id')).data).toEqual([])

    // Outsiders can't send, nobody can reach someone outside the room, and nobody inserts directly.
    expect((await outsider().client.rpc('send_virtual_space_signal', { p_space_id: room, p_to: ben().id, p_kind: 'offer', p_payload: offer })).error?.code).toBe('42501')
    await ada().client.rpc('send_virtual_space_signal', { p_space_id: room, p_to: outsider().id, p_kind: 'offer', p_payload: offer })
    expect((await service.from('virtual_space_signals').select('id').eq('to_user', outsider().id)).data).toEqual([])
    expect((await ada().client.from('virtual_space_signals').insert({ space_id: room, from_user: ada().id, to_user: ben().id, kind: 'bye' })).error).not.toBeNull()
    expect((await ada().client.rpc('send_virtual_space_signal', { p_space_id: room, p_to: ben().id, p_kind: 'hack', p_payload: {} })).error).not.toBeNull()
  })
})
