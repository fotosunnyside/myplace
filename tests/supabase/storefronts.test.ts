/**
 * Storefront limits against a real Supabase stack: one shop for everyone, up to five with PLACES Pass,
 * enforced by the database whatever the browser sends. Skipped without SUPABASE_TEST_* variables.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_TEST_URL ?? ''
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY ?? ''
const enabled = Boolean(URL && ANON && SERVICE)
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const run = `${Date.now()}`

describe.skipIf(!enabled)('storefronts (Supabase)', () => {
  let service: SupabaseClient
  const people: { client: SupabaseClient; id: string }[] = []

  async function user(label: string) {
    const email = `${label}-shops-${run}@places.test`
    const created = await service.auth.admin.createUser({ email, password: 'correct-horse-battery', email_confirm: true, user_metadata: { name: label, username: `${label}_s${run.slice(-6)}` } })
    if (created.error) throw created.error
    const client = createClient(URL, ANON, opts)
    const { error } = await client.auth.signInWithPassword({ email, password: 'correct-horse-battery' })
    if (error) throw error
    return { client, id: created.data.user.id }
  }
  const open = (who: { client: SupabaseClient; id: string }, n: number) =>
    who.client.from('shops').insert({ id: `shp_${who.id.slice(0, 8)}_${n}_${run}`, owner_id: who.id, name: `Shop ${n}`, category: 'Art', description: '', image: '' })

  beforeAll(async () => {
    service = createClient(URL, SERVICE, opts)
    people.push(await user('plain'), await user('passholder'))
  })

  afterAll(async () => {
    if (!enabled) return
    for (const p of people) await service.auth.admin.deleteUser(p.id)
  })

  it('gives everyone one storefront', async () => {
    const [plain] = people
    expect((await open(plain, 1)).error).toBeNull()
    const second = await open(plain, 2)
    expect(second.error?.message).toMatch(/PLACES Pass lets you open up to 5 storefronts/)
  })

  it('lets PLACES Pass members open up to five', async () => {
    const pass = people[1]
    await pass.client
      .from('member_plans')
      .insert({ user_id: pass.id, kind: 'pass', quantity: 1, status: 'active', via: 'test', renews_at: new Date(Date.now() + 30 * 864e5).toISOString() })
      .throwOnError()
    for (let n = 1; n <= 5; n++) expect((await open(pass, n)).error).toBeNull()
    expect((await open(pass, 6)).error?.message).toMatch(/storefront limit/)
    const { count } = await service.from('shops').select('id', { count: 'exact', head: true }).eq('owner_id', pass.id)
    expect(count).toBe(5)
  })
})
