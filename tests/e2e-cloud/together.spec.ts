/**
 * Two people in a Virtual Place against a real Supabase stack (see playwright.cloud.config.ts):
 * they arrive near each other and connect person to person (fake camera/mic), one walks away and
 * the connection closes, they chat as bubbles or in the chat panel, and one adds the other as a friend.
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
let roomId = ''

async function makeUser(name: string) {
  const email = `${name.toLowerCase()}-together-${run}@places.test`
  const { error } = await service().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, username: `${name.toLowerCase()}_t${run % 100000}` } })
  if (error) throw error
  return email
}

async function signIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 1360, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('./')
  await page.getByRole('button', { name: 'Sign in' }).filter({ visible: true }).first().click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(page.getByText(/Welcome back|Signed in/)).toBeVisible()
  await page.waitForTimeout(400)
  return page
}

async function enter(page: Page, slug: string) {
  await page.goto(`yourplace/place/?room=${slug}`)
  await page.getByRole('button', { name: /Enter|Start|Join|Go in/ }).first().click()
  await expect(page.getByRole('toolbar', { name: 'Room controls' })).toBeVisible()
  const camera = page.getByRole('toolbar', { name: 'Room controls' }).getByRole('button', { name: 'Turn camera on' })
  if (await camera.count()) await camera.click()
}

test.afterAll(async () => {
  if (roomId) await service().from('virtual_spaces').delete().eq('id', roomId)
})

test('two people meet in a Virtual Place: walk, talk, chat and become friends', async ({ browser }) => {
  test.setTimeout(150_000)
  const slug = `together-${run}`
  const { data } = await service()
    .from('virtual_spaces')
    .insert({ name: `Meetup ${run % 10000}`, slug, description: 'A test meetup.', room_type: 'meeting', visibility: 'members', max_participants: 12, settings: {} })
    .select('id')
    .single()
    .throwOnError()
  roomId = data!.id

  const ada = await signIn(browser, await makeUser('Ada'))
  const ben = await signIn(browser, await makeUser('Ben'))
  await enter(ada, slug)
  await enter(ben, slug)

  // They arrive near each other: each sees the other nearby, with live video from the other side.
  const benOnAda = ada.getByRole('button', { name: /^Ben/ })
  await expect(benOnAda).toHaveAttribute('aria-label', /Nearby/, { timeout: 30_000 })
  await expect(ada.getByTestId('talk-ring')).toBeVisible()
  await expect.poll(async () => ada.locator('video').count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(2)
  await expect.poll(async () => ben.locator('video').count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(2)

  // Ben walks to the far corner: the connection closes on both sides.
  const floor = await ben.getByTestId('room-floor').boundingBox()
  const me = await ben.getByTestId('my-circle').boundingBox()
  await ben.mouse.move(me!.x + me!.width / 2, me!.y + me!.height / 2)
  await ben.mouse.down()
  await ben.mouse.move(floor!.x + floor!.width * 0.3, floor!.y + floor!.height * 0.3, { steps: 5 })
  await ben.mouse.move(floor!.x + 30, floor!.y + 30, { steps: 5 })
  await ben.mouse.up()
  await expect(benOnAda).not.toHaveAttribute('aria-label', /Nearby/, { timeout: 20_000 })
  await expect.poll(async () => ada.locator('video').count(), { timeout: 20_000 }).toBe(1)

  // Chat as bubbles: Ada says hello, Ben sees it beside her circle.
  await ada.getByRole('button', { name: 'Chat' }).click()
  await ada.getByLabel('Message the room').fill('Hello Ben!')
  await ada.getByRole('button', { name: 'Send' }).click()
  await expect(ben.getByTestId('speech-bubble').filter({ hasText: 'Hello Ben!' })).toBeVisible()

  // Ben prefers the chat panel.
  await ben.getByRole('button', { name: 'Chat' }).click()
  await ben.getByRole('radio', { name: 'Chat' }).click()
  const panel = ben.getByRole('complementary', { name: 'Room chat' })
  await expect(panel.getByText('Hello Ben!')).toBeVisible()
  await panel.getByLabel('Message the room').fill('Hi Ada 👋')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(ada.getByTestId('speech-bubble').filter({ hasText: 'Hi Ada 👋' })).toBeVisible()

  // Ben taps Ada: walks back over to talk, then adds her as a friend.
  await ben.getByRole('button', { name: /^Ada/ }).click()
  await ben.getByRole('button', { name: /Go talk to Ada/ }).click()
  await expect(ben.getByRole('button', { name: /^Ada/ })).toHaveAttribute('aria-label', /Nearby/, { timeout: 20_000 })
  await ben.getByRole('button', { name: /^Ada/ }).click()
  const card = ben.getByRole('dialog', { name: /^Ada/ })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Add friend' }).click()
  await expect(ben.getByRole('button', { name: 'Friends' })).toHaveAttribute('aria-pressed', 'true')
  await expect(ben.getByText(/Ada is in your friends/)).toBeVisible()
})
