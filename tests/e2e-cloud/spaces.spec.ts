/**
 * The Virtual Spaces admin → user loop against a real Supabase stack (see playwright.cloud.config.ts).
 * Admin edits a room in the dashboard; people see it live, capacity and closing are enforced by the database.
 */
import { expect, test, type Browser, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_TEST_URL ?? ''
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY ?? ''
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const run = Date.now()
const password = 'correct-horse-battery'

test.skip(!URL || !SERVICE || !ANON, 'Needs a running Supabase stack')

const service = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

async function makeUser(name: string, admin = false) {
  const email = `${name.toLowerCase()}-${run}@places.test`
  const { data, error } = await service().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, username: `${name.toLowerCase()}_${run % 100000}` } })
  if (error) throw error
  if (admin) await service().from('admin_users').insert({ user_id: data.user.id }).throwOnError()
  return { email, id: data.user.id }
}

async function signIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 1360, height: 900 } })
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  await page.goto('./')
  await page.getByRole('button', { name: 'Sign in' }).filter({ visible: true }).first().click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(page.getByText(/Welcome back|Signed in/)).toBeVisible()
  await page.waitForTimeout(400) // let this device save the sign-in before hard navigations
  return page
}

const townHall = async () => (await service().from('virtual_spaces').select('*').eq('slug', 'town-hall').single()).data

test.afterAll(async () => {
  if (!URL || !SERVICE) return
  await service().from('virtual_spaces').update({ name: 'Town Hall', max_participants: 20, is_active: true, background_style: 'default', background_url: null, background_path: null }).eq('slug', 'town-hall')
  await service().from('virtual_space_participants').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
})

test('admins change rooms without code; people see it live and the database enforces it', async ({ browser }) => {
  test.setTimeout(120_000)
  const admin = await makeUser('Ada', true)
  const member = await makeUser('Milo')

  // A regular member can't reach the admin tools.
  const milo = await signIn(browser, member.email)
  await milo.goto('admin/spaces/')
  await expect(milo.getByText('This area is for PLACES admins')).toBeVisible()

  // Admin → Dashboard → Virtual Spaces → Town Hall → Edit Room
  const ada = await signIn(browser, admin.email)
  await ada.getByRole('button', { name: 'Account menu' }).click()
  await ada.getByRole('menuitem', { name: 'Admin' }).click()
  await ada.getByRole('link', { name: /Virtual Spaces/ }).click()
  await expect(ada.getByRole('heading', { name: 'Town Hall' })).toBeVisible()
  await expect(ada.getByRole('heading', { name: 'Accountability Department' })).toBeVisible()
  await ada.getByRole('link', { name: 'Edit Town Hall' }).click()

  await ada.getByLabel('Room name').fill('Town Square')
  await ada.getByLabel('Participant capacity').fill('1')
  await expect(ada.getByText('Choose between 2 and 500 people.').first()).toBeVisible() // validated before it reaches the database
  await ada.getByLabel('Participant capacity').fill('2')
  await ada.getByTestId('background-input').setInputFiles('tests/e2e/room-background.jpg')
  await expect(ada.getByText('New image ready — save to publish it.')).toBeVisible()
  await ada.getByRole('button', { name: 'Save' }).click()
  await expect(ada.getByText('Town Square saved — it’s live now.').last()).toBeVisible()

  const saved = await townHall()
  expect(saved).toMatchObject({ name: 'Town Square', max_participants: 2, background_style: 'custom' })
  expect(saved.background_path).toMatch(new RegExp(`^${saved.id}/`))
  expect((await fetch(saved.background_url)).status).toBe(200)

  // The member's Spaces page picks up the new name, and they walk in.
  await milo.goto('myplace/')
  await expect(milo.getByRole('heading', { name: 'Town Square' })).toBeVisible()
  await milo.getByRole('button', { name: 'Enter Town Square' }).click()
  await expect(milo.getByRole('toolbar', { name: 'Room controls' })).toBeVisible()
  await expect(milo.getByTestId('room-count')).toHaveText(/1 person here/)
  await expect(milo.getByTestId('media-note')).toBeVisible()

  // Someone else takes the second place (straight through the API, as any client could)...
  const zed = await makeUser('Zed')
  const zedClient = createClient(URL, ANON, { auth: { persistSession: false } })
  await zedClient.auth.signInWithPassword({ email: zed.email, password })
  expect((await zedClient.rpc('join_virtual_space', { p_space_id: saved.id })).error).toBeNull()
  await expect(milo.getByTestId('room-count')).toHaveText(/2 people here/, { timeout: 15_000 })

  // ...so with capacity 2 the database turns the next person away.
  await ada.goto('myplace/space/?room=town-hall')
  await ada.getByRole('button', { name: 'Enter Town Square' }).click()
  await expect(ada.getByText('This room is currently full.')).toBeVisible()

  // Admin closes the room: Milo is sent out live, and the card says CLOSED.
  await ada.goto('admin/spaces/')
  await ada.getByRole('link', { name: 'Edit Town Square' }).click()
  await ada.getByRole('radio', { name: 'Closed' }).click()
  await ada.getByRole('button', { name: 'Save' }).click()
  await expect(ada.getByText('Town Square saved — it’s live now.').last()).toBeVisible()
  await expect(milo.getByText('This room is currently closed.')).toBeVisible({ timeout: 20_000 })
  await milo.goto('yourplace/')
  await expect(milo.getByRole('button', { name: 'Town Square is closed' })).toBeDisabled()
  await milo.goto('myplace/')
  await expect(milo.getByText('Closed', { exact: true }).first()).toBeVisible()
  await expect(milo.getByText('Closed for now').first()).toBeVisible()

  // Reopen, reset background: the old image is cleaned out of storage.
  await ada.getByRole('radio', { name: 'Live' }).click()
  await ada.getByLabel('Participant capacity').fill('20')
  await ada.getByRole('button', { name: 'Reset to default' }).click()
  await ada.getByRole('button', { name: 'Save' }).click()
  await expect(ada.getByText('Town Square saved — it’s live now.').last()).toBeVisible()
  const reset = await townHall()
  expect(reset).toMatchObject({ is_active: true, max_participants: 20, background_style: 'default', background_url: null })
  await expect.poll(async () => (await fetch(saved.background_url)).status).not.toBe(200)

  // And Milo can walk back in, straight from the square on YourPlace.
  await milo.goto('yourplace/')
  await milo.getByRole('button', { name: 'Go to Town Square' }).click()
  await expect(milo.getByRole('toolbar', { name: 'Room controls' })).toBeVisible()
  await milo.getByRole('button', { name: 'Leave' }).click()
  await expect(milo).toHaveURL(/\/myplace\/$/)
  await expect.poll(async () => (await service().from('virtual_space_participants').select('user_id').eq('user_id', member.id)).data?.length).toBe(0)
})

test('a room keeps you while you look around PLACES', async ({ browser }) => {
  const member = await makeUser('Noor')
  const page: Page = await signIn(browser, member.email)
  await page.goto('myplace/space/?room=accountability-room')
  await page.getByRole('button', { name: 'Start Working' }).click()
  await expect(page.getByText('Bring something you need to finish.')).toBeVisible()
  await page.getByRole('link', { name: 'MindPlace' }).last().click() // the room's own way around PLACES
  await expect(page.getByRole('region', { name: /You're in Accountability Department/ })).toBeVisible()
  await page.getByRole('link', { name: 'Return to Accountability Department' }).click()
  await expect(page.getByRole('toolbar', { name: 'Room controls' })).toBeVisible()
})
