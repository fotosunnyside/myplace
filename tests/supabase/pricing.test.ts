/**
 * PLACES pricing, enforced by the database (supabase/migrations/*_pricing.sql):
 * who may publish, what PLACES takes from a course sale, free job posts with the Pass, and who may host rooms.
 * Skipped when the Supabase test variables aren't set (see virtual-spaces.test.ts).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_TEST_URL ?? ''
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY ?? ''
const enabled = Boolean(URL && ANON && SERVICE)

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const run = `${Date.now()}`
const month = () => new Date(Date.now() + 30 * 86_400_000).toISOString()

describe.skipIf(!enabled)('pricing (Supabase)', () => {
  let service: SupabaseClient
  const made: string[] = []

  async function member(label: string) {
    const email = `${label}-${run}@places.test`
    const created = await service.auth.admin.createUser({ email, password: 'correct-horse-battery', email_confirm: true, user_metadata: { name: label, username: `${label}_${run}` } })
    if (created.error) throw created.error
    made.push(created.data.user.id)
    const client = createClient(URL, ANON, opts)
    const { error } = await client.auth.signInWithPassword({ email, password: 'correct-horse-battery' })
    if (error) throw error
    return { client, id: created.data.user.id }
  }
  const plan = (c: SupabaseClient, user_id: string, kind: 'create' | 'host' | 'pass', quantity = 1) =>
    c.from('member_plans').insert({ user_id, kind, quantity, status: 'active', via: 'test', renews_at: month() })
  const course = (id: string, expert_id: string, price = 0, billing = 'once') => ({ id, expert_id, title: `Course ${id}`, image: '/x.webp', kind: 'course', price, billing })

  beforeAll(() => {
    service = createClient(URL, SERVICE, opts)
  })

  afterAll(async () => {
    if (!enabled) return
    for (const id of made) await service.auth.admin.deleteUser(id)
  })

  it('publishes one course per Create, as many as you like with the Pass', async () => {
    const { client, id } = await member('creator')
    expect((await client.from('courses').insert(course(`crs_a${run}`, id))).error).not.toBeNull() // no plan
    expect((await plan(client, id, 'create')).error).toBeNull()
    expect((await client.from('courses').insert(course(`crs_a${run}`, id))).error).toBeNull()
    expect((await client.from('courses').insert(course(`crs_b${run}`, id))).error).not.toBeNull() // Create covers one
    expect((await client.from('member_plans').update({ quantity: 2 }).eq('user_id', id).eq('kind', 'create')).error).toBeNull()
    expect((await client.from('courses').insert(course(`crs_b${run}`, id, 1900, 'monthly'))).error).toBeNull()
    expect((await client.from('courses').insert(course(`crs_c${run}`, id))).error).not.toBeNull()
    expect((await plan(client, id, 'pass')).error).toBeNull()
    expect((await client.from('courses').insert(course(`crs_c${run}`, id))).error).toBeNull()
    // Plans are yours alone.
    const other = await member('stranger')
    expect((await plan(other.client, id, 'pass')).error).not.toBeNull()
  })

  it('takes 5% of a paid enrollment — 0% when the creator has the Pass — and never lets the buyer set it', async () => {
    const creator = await member('teacher')
    const buyer = await member('student')
    await plan(creator.client, creator.id, 'create', 2).throwOnError()
    await creator.client.from('courses').insert([course(`crs_p${run}`, creator.id, 10000), course(`crs_m${run}`, creator.id, 2000, 'monthly')]).throwOnError()

    expect((await buyer.client.from('course_purchases').insert({ id: `cpu_x${run}`, course_id: `crs_p${run}`, buyer_id: buyer.id, via: 'test', fee: 0 })).error).not.toBeNull()
    await buyer.client.from('course_purchases').insert({ id: `cpu_p${run}`, course_id: `crs_p${run}`, buyer_id: buyer.id, via: 'test' }).throwOnError()
    await buyer.client.from('course_purchases').insert({ id: `cpu_m${run}`, course_id: `crs_m${run}`, buyer_id: buyer.id, via: 'test' }).throwOnError()
    const { data } = await service.from('course_purchases').select('id, total, fee').in('id', [`cpu_p${run}`, `cpu_m${run}`]).order('id', { ascending: false })
    expect(data).toEqual([
      { id: `cpu_p${run}`, total: 10000, fee: 500 },
      { id: `cpu_m${run}`, total: 2000, fee: 100 },
    ])

    await plan(creator.client, creator.id, 'pass').throwOnError()
    const late = await member('latecomer')
    await late.client.from('course_purchases').insert({ id: `cpu_l${run}`, course_id: `crs_p${run}`, buyer_id: late.id, via: 'test' }).throwOnError()
    expect((await service.from('course_purchases').select('fee').eq('id', `cpu_l${run}`).single()).data).toEqual({ fee: 0 })
  })

  it('includes job posts with the Pass, and only with it', async () => {
    const { client, id } = await member('employer')
    const opp = (oid: string, paid_via: string) => ({ id: oid, posted_by: id, title: 'Studio assistant', type: 'Part Time', kind: 'job', description: 'Help run our studio two mornings a week.', paid_via })
    expect((await client.from('opportunities').insert(opp(`opp_a${run}`, 'pass'))).error).not.toBeNull()
    expect((await client.from('opportunities').insert(opp(`opp_b${run}`, 'test'))).error).toBeNull()
    await plan(client, id, 'pass').throwOnError()
    expect((await client.from('opportunities').insert(opp(`opp_a${run}`, 'pass'))).error).toBeNull()
  })

  it('lets hosts open their own rooms within the limits, and nobody else', async () => {
    const host = await member('host')
    const guest = await member('guest')
    const room = (slug: string, max = 8) => ({ name: 'Writers', slug, room_type: 'meeting', visibility: 'members', max_participants: max })

    expect((await host.client.from('virtual_spaces').insert(room(`writers-a${run}`)).select()).error).not.toBeNull() // no plan
    await plan(host.client, host.id, 'host').throwOnError()
    expect((await host.client.from('virtual_spaces').insert(room(`writers-b${run}`, 50)).select()).error).not.toBeNull() // over 12
    expect((await host.client.from('virtual_spaces').insert({ ...room(`writers-c${run}`), is_official: true }).select()).error).not.toBeNull()
    const made = await host.client.from('virtual_spaces').insert(room(`writers-d${run}`)).select().single()
    expect(made.error).toBeNull()
    expect(made.data).toMatchObject({ created_by: host.id, is_official: false, max_participants: 8 })
    const spaceId = made.data!.id as string

    // The host manages it (within limits); others can't — but they can come in.
    expect((await host.client.from('virtual_spaces').update({ name: 'Writers Circle' }).eq('id', spaceId).select()).data).toHaveLength(1)
    expect((await host.client.from('virtual_spaces').update({ max_participants: 100 }).eq('id', spaceId)).error).not.toBeNull()
    expect((await guest.client.from('virtual_spaces').update({ name: 'Mine now' }).eq('id', spaceId).select()).data).toEqual([])
    expect((await guest.client.from('virtual_spaces').delete().eq('id', spaceId).select()).data).toEqual([])
    expect((await guest.client.rpc('join_virtual_space', { p_space_id: spaceId })).error).toBeNull()
    await guest.client.rpc('leave_virtual_space', { p_space_id: spaceId })

    // When the host stops hosting, the room closes.
    await host.client.from('member_plans').update({ status: 'canceled' }).eq('user_id', host.id).eq('kind', 'host').throwOnError()
    expect((await guest.client.rpc('join_virtual_space', { p_space_id: spaceId })).error?.code).toBe('PLC03')

    // Host removes their own room.
    expect((await host.client.from('virtual_spaces').delete().eq('id', spaceId).select()).data).toHaveLength(1)
  })
})
