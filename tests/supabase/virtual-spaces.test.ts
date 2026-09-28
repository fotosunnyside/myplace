/**
 * Virtual Spaces against a real Supabase stack: RLS, admin authorization, storage rules,
 * atomic capacity, closed rooms and ghost presence.
 *
 *   npx supabase start            # applies supabase/migrations
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_ANON_KEY=... SUPABASE_TEST_SERVICE_KEY=... npm run test:supabase
 *
 * The service key is used only here, to set up fixtures (grant admin, age presence rows) — never in the app.
 * Skipped when the variables aren't set.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_TEST_URL ?? ''
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY ?? ''
const enabled = Boolean(URL && ANON && SERVICE)

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const run = `${Date.now()}`
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0))

describe.skipIf(!enabled)('virtual spaces (Supabase)', () => {
  let service: SupabaseClient
  let anon: SupabaseClient
  let admin: SupabaseClient
  const users: SupabaseClient[] = []
  const ids: string[] = []
  let adminId = ''
  let townHall: { id: string; max_participants: number; name: string }
  let insiderIdx = -1

  async function user(label: string) {
    const email = `${label}-${run}@places.test`
    const created = await service.auth.admin.createUser({ email, password: 'correct-horse-battery', email_confirm: true, user_metadata: { name: label } })
    if (created.error) throw created.error
    const c = createClient(URL, ANON, opts)
    const { error } = await c.auth.signInWithPassword({ email, password: 'correct-horse-battery' })
    if (error) throw error
    return { client: c, id: created.data.user.id }
  }

  beforeAll(async () => {
    service = createClient(URL, SERVICE, opts)
    anon = createClient(URL, ANON, opts)
    const a = await user('admin')
    admin = a.client
    adminId = a.id
    await service.from('admin_users').insert({ user_id: adminId, note: 'test' }).throwOnError()
    for (const n of ['ana', 'ben', 'cy', 'dee']) {
      const u = await user(n)
      users.push(u.client)
      ids.push(u.id)
    }
    const { data } = await service.from('virtual_spaces').select('*').eq('slug', 'town-hall').single()
    townHall = data
  })

  afterAll(async () => {
    if (!enabled) return
    await service.from('virtual_spaces').update({ max_participants: 20, is_active: true, name: 'Town Hall', allow_camera: true, background_style: 'default', background_url: null, background_path: null }).eq('slug', 'town-hall')
    await service.from('virtual_space_participants').delete().eq('space_id', townHall.id)
    for (const id of [adminId, ...ids]) await service.auth.admin.deleteUser(id)
  })

  it('seeds the two official launch rooms with default settings', async () => {
    const { data } = await anon.from('virtual_spaces').select('slug,name,description,room_type,max_participants,is_active,allow_camera,allow_microphone,is_official').order('sort_order')
    expect(data).toEqual([
      { slug: 'town-hall', name: 'Town Hall', description: "See who's around. Drop in and say hello.", room_type: 'social', max_participants: 20, is_active: true, allow_camera: true, allow_microphone: true, is_official: true },
      { slug: 'accountability-room', name: 'Accountability Room', description: 'Bring your work. Stay focused together.', room_type: 'accountability', max_participants: 20, is_active: true, allow_camera: true, allow_microphone: true, is_official: true },
    ])
  })

  it('reports admin rights from the database', async () => {
    expect((await admin.rpc('is_admin')).data).toBe(true)
    expect((await users[0].rpc('is_admin')).data).toBe(false)
    expect((await anon.rpc('is_admin')).data).toBe(false)
  })

  it('does not let regular people or guests change rooms', async () => {
    for (const c of [users[0], anon]) {
      const { data } = await c.from('virtual_spaces').update({ max_participants: 999, is_active: false, allow_camera: false, background_url: 'https://evil.test/x.png', background_style: 'custom' }).eq('id', townHall.id).select()
      expect(data ?? []).toEqual([])
    }
    const { data } = await service.from('virtual_spaces').select('max_participants,is_active,allow_camera,background_style').eq('id', townHall.id).single()
    expect(data).toEqual({ max_participants: 20, is_active: true, allow_camera: true, background_style: 'default' })

    const insert = await users[0].from('virtual_spaces').insert({ name: 'Mine', slug: `mine-${run}`, room_type: 'social' })
    expect(insert.error).not.toBeNull()
    const del = await users[0].from('virtual_spaces').delete().eq('id', townHall.id).select()
    expect(del.data ?? []).toEqual([])
  })

  it('does not let anyone write presence or admin rows directly', async () => {
    const p = await users[0].from('virtual_space_participants').insert({ space_id: townHall.id, user_id: ids[0], display_name: 'x' })
    expect(p.error).not.toBeNull()
    const a = await users[0].from('admin_users').insert({ user_id: ids[0] })
    expect(a.error).not.toBeNull()
    expect((await users[0].rpc('is_admin')).data).toBe(false)
  })

  it('lets admins change room settings, but not make rooms official or claim them', async () => {
    const { data, error } = await admin.from('virtual_spaces').update({ name: 'Town Square', max_participants: 25, allow_camera: false }).eq('id', townHall.id).select().single()
    expect(error).toBeNull()
    expect(data).toMatchObject({ name: 'Town Square', max_participants: 25, allow_camera: false })
    const bad = await admin.from('virtual_spaces').update({ is_official: false }).eq('id', townHall.id)
    expect(bad.error?.code).toBe('42501')
    const invalid = await admin.from('virtual_spaces').update({ max_participants: 1 }).eq('id', townHall.id)
    expect(invalid.error).not.toBeNull()
    await admin.from('virtual_spaces').update({ name: 'Town Hall', max_participants: 20, allow_camera: true }).eq('id', townHall.id).throwOnError()
  })

  it('only lets admins upload and delete room backgrounds', async () => {
    const bucket = 'virtual-space-backgrounds'
    const blocked = await users[0].storage.from(bucket).upload(`${townHall.id}/user-${run}.png`, PNG, { contentType: 'image/png' })
    expect(blocked.error).not.toBeNull()
    const outside = await admin.storage.from(bucket).upload(`not-a-room/${run}.png`, PNG, { contentType: 'image/png' })
    expect(outside.error).not.toBeNull()
    const wrongType = await admin.storage.from(bucket).upload(`${townHall.id}/${run}.gif`, PNG, { contentType: 'image/gif' })
    expect(wrongType.error).not.toBeNull()

    const path = `${townHall.id}/${run}.png`
    const ok = await admin.storage.from(bucket).upload(path, PNG, { contentType: 'image/png' })
    expect(ok.error).toBeNull()
    const url = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl
    expect((await fetch(url)).status).toBe(200) // anyone can load the background
    await admin.from('virtual_spaces').update({ background_style: 'custom', background_url: url, background_path: path }).eq('id', townHall.id).throwOnError()

    const userDelete = await users[0].storage.from(bucket).remove([path])
    expect(userDelete.data ?? []).toEqual([])
    expect((await fetch(url)).status).toBe(200)
    const adminDelete = await admin.storage.from(bucket).remove([path])
    expect(adminDelete.data?.length).toBe(1)
    await admin.from('virtual_spaces').update({ background_style: 'default', background_url: null, background_path: null }).eq('id', townHall.id).throwOnError()
  })

  it('enforces capacity atomically when people join at the same moment', async () => {
    await admin.from('virtual_spaces').update({ max_participants: 2 }).eq('id', townHall.id).throwOnError()
    const results = await Promise.all(users.map((c) => c.rpc('join_virtual_space', { p_space_id: townHall.id, p_display_name: 'Racer' })))
    const admitted = results.filter((r) => !r.error)
    const full = results.filter((r) => r.error?.code === 'PLC04')
    expect(admitted).toHaveLength(2)
    expect(full).toHaveLength(2)
    expect(full[0].error?.message).toBe('This room is currently full.')

    const occ = await users[0].rpc('virtual_space_occupancy')
    expect(occ.data.find((r: { space_id: string }) => r.space_id === townHall.id).participant_count).toBe(2)

    // Re-entering (another tab) keeps your place instead of needing a second one.
    insiderIdx = results.findIndex((r) => !r.error)
    const insider = users[insiderIdx]
    expect((await insider.rpc('join_virtual_space', { p_space_id: townHall.id })).error).toBeNull()
  })

  it('drops ghosts who stopped heartbeating, freeing their place', async () => {
    // Age everyone's heartbeat past the stale window, as if their laptops closed.
    await service.from('virtual_space_participants').update({ last_seen_at: new Date(Date.now() - 120_000).toISOString() }).eq('space_id', townHall.id).throwOnError()
    const occ = await anon.rpc('virtual_space_occupancy')
    expect(occ.data.find((r: { space_id: string }) => r.space_id === townHall.id).participant_count).toBe(0)
    const roster = await users[3].rpc('virtual_space_roster', { p_space_id: townHall.id })
    expect(roster.data).toEqual([])

    const ghost = users[insiderIdx]
    expect((await ghost.rpc('touch_virtual_space', { p_space_id: townHall.id })).data).toBe(false)

    const late = await Promise.all([users[2], users[3]].map((c) => c.rpc('join_virtual_space', { p_space_id: townHall.id })))
    expect(late.every((r) => !r.error)).toBe(true)
  })

  it('reports camera/mic only when the room allows them, and grants media only to people inside', async () => {
    expect((await users[2].rpc('touch_virtual_space', { p_space_id: townHall.id, p_camera_on: true, p_mic_on: true })).data).toBe(true)
    await admin.from('virtual_spaces').update({ allow_camera: false }).eq('id', townHall.id).throwOnError()
    await users[2].rpc('touch_virtual_space', { p_space_id: townHall.id, p_camera_on: true, p_mic_on: true })
    const roster = await users[3].rpc('virtual_space_roster', { p_space_id: townHall.id })
    expect(roster.data.find((p: { user_id: string }) => p.user_id === ids[2])).toMatchObject({ camera_on: false, mic_on: true })

    const grant = await users[2].rpc('virtual_space_media_grant', { p_space_id: townHall.id }).maybeSingle()
    expect(grant.data).toMatchObject({ user_id: ids[2], can_publish_video: false, can_publish_audio: true })
    const outsider = await users[0].rpc('virtual_space_media_grant', { p_space_id: townHall.id }).maybeSingle()
    expect(outsider.data).toBeNull()
    await admin.from('virtual_spaces').update({ allow_camera: true }).eq('id', townHall.id).throwOnError()
  })

  it('closes rooms: everyone is released and nobody new gets in', async () => {
    await admin.from('virtual_spaces').update({ is_active: false }).eq('id', townHall.id).throwOnError()
    const { count } = await service.from('virtual_space_participants').select('*', { count: 'exact', head: true }).eq('space_id', townHall.id)
    expect(count).toBe(0)
    const join = await users[0].rpc('join_virtual_space', { p_space_id: townHall.id })
    expect(join.error?.code).toBe('PLC03')
    expect((await users[2].rpc('touch_virtual_space', { p_space_id: townHall.id })).data).toBe(false)
    // Guests still see the room — and that it's closed.
    const { data } = await anon.from('virtual_spaces').select('is_active').eq('id', townHall.id).single()
    expect(data?.is_active).toBe(false)
    await admin.from('virtual_spaces').update({ is_active: true, max_participants: 20 }).eq('id', townHall.id).throwOnError()
  })

  it('requires an account to enter', async () => {
    const join = await anon.rpc('join_virtual_space', { p_space_id: townHall.id })
    expect(join.error).not.toBeNull()
    const roster = await anon.rpc('virtual_space_roster', { p_space_id: townHall.id })
    expect(roster.error).not.toBeNull()
  })
})
