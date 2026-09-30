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

  it('keeps bubble sizes within limits, and the same size where the room says so', async () => {
    await ada().client.rpc('set_virtual_space_look', { p_space_id: room, p_scale: 2.5, p_status: `  ${'x'.repeat(80)}  ` }).throwOnError()
    type Row = { user_id: string; bubble_scale: number | null; status: string | null }
    const look = async () => ((await ben().client.rpc('virtual_space_roster', { p_space_id: room })).data as Row[]).find((r) => r.user_id === ada().id)
    expect(await look()).toMatchObject({ bubble_scale: 1.8, status: 'x'.repeat(60) })

    await service.from('virtual_spaces').update({ allow_bubble_resize: false }).eq('id', room).throwOnError()
    await ada().client.rpc('set_virtual_space_look', { p_space_id: room, p_scale: 1.4, p_status: '' }).throwOnError()
    expect(await look()).toMatchObject({ bubble_scale: null, status: null })
    await service.from('virtual_spaces').update({ allow_bubble_resize: true }).eq('id', room)
    // Outside the room there's nothing to change.
    expect((await outsider().client.rpc('set_virtual_space_look', { p_space_id: room, p_scale: 1, p_status: 'hi' })).data).toBe(false)
  })

  it('lets PLACES Pass members play library tracks for the room, and everyone in it see what’s on', async () => {
    // Only admins stock the library; members see active tracks.
    const upload = { title: `Morning Focus ${run}`, artist: 'PLACES', license: 'test', path: `test-${run}.mp3`, url: 'https://example.com/a.mp3', duration_s: 180 }
    expect((await ben().client.from('room_tracks').insert(upload)).error).not.toBeNull()
    const { data: track } = await service.from('room_tracks').insert(upload).select('id').single().throwOnError()
    const { data: hidden } = await service
      .from('room_tracks')
      .insert({ ...upload, title: 'Hidden', path: `hidden-${run}.mp3`, is_active: false })
      .select('id')
      .single()
      .throwOnError()
    expect((await ada().client.from('room_tracks').select('id').in('id', [track!.id, hidden!.id])).data).toEqual([{ id: track!.id }])
    expect((await ada().client.from('room_tracks').update({ title: 'Mine now' }).eq('id', track!.id).select('id')).data).toEqual([])

    const play = (who: { client: SupabaseClient }, id: string | null) => who.client.rpc('set_virtual_space_track', { p_space_id: room, p_track_id: id })
    expect((await play(ada(), track!.id)).error?.message).toMatch(/PLACES Pass/)

    await ben()
      .client.from('member_plans')
      .insert({ user_id: ben().id, kind: 'pass', quantity: 1, status: 'active', via: 'test', renews_at: new Date(Date.now() + 30 * 864e5).toISOString() })
      .throwOnError()
    expect((await play(ben(), hidden!.id)).error).not.toBeNull()
    expect((await play(ben(), track!.id)).error).toBeNull()
    expect((await ada().client.from('virtual_space_music').select('track_id, title, room_tracks(url)').eq('space_id', room)).data).toEqual([
      { track_id: track!.id, title: upload.title, room_tracks: { url: upload.url } },
    ])
    expect((await outsider().client.from('virtual_space_music').select('track_id').eq('space_id', room)).data).toEqual([])
    expect((await ada().client.from('virtual_space_music').insert({ space_id: room, track_id: track!.id })).error).not.toBeNull()
    // YouTube is switched off.
    expect((await ben().client.rpc('set_virtual_space_music', { p_space_id: room, p_video_id: 'jfKfPfyJRdk', p_title: 'x' })).error).not.toBeNull()

    expect((await play(ben(), null)).error).toBeNull()
    expect((await ada().client.from('virtual_space_music').select('track_id').eq('space_id', room)).data).toEqual([])
    await service.from('room_tracks').delete().in('id', [track!.id, hidden!.id])
  })
})
