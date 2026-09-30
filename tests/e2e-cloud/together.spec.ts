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
let trackId = ''
let trackPath = ''

/** A few seconds of silence as a WAV file, to stock the music library with. */
function silentWav(seconds = 3, rate = 8000) {
  const samples = seconds * rate
  const b = Buffer.alloc(44 + samples)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + samples, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate, 28)
  b.writeUInt16LE(1, 32)
  b.writeUInt16LE(8, 34)
  b.write('data', 36)
  b.writeUInt32LE(samples, 40)
  b.fill(128, 44)
  return b
}
const userIds: Record<string, string> = {}

async function makeUser(name: string, pass = false) {
  const email = `${name.toLowerCase()}-together-${run}@places.test`
  const { data, error } = await service().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, username: `${name.toLowerCase()}_t${run % 100000}` } })
  if (error) throw error
  userIds[name] = data.user.id
  if (pass)
    await service()
      .from('member_plans')
      .insert({ user_id: data.user.id, kind: 'pass', quantity: 1, status: 'active', via: 'test', renews_at: new Date(Date.now() + 30 * 864e5).toISOString() })
      .throwOnError()
  return email
}

const pageErrors: string[] = []

async function signIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 1360, height: 900 } })
  // Current Chrome returns a Promise from scrollIntoView; behave the same whatever browser runs the test.
  await ctx.addInitScript(() => {
    const scroll = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element, ...args: Parameters<Element['scrollIntoView']>) {
      scroll.apply(this, args)
      return Promise.resolve() as unknown as void
    }
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => pageErrors.push(`${email.split('-')[0]}: ${e.message}`))
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
  if (trackId) await service().from('room_tracks').delete().eq('id', trackId)
  if (trackPath) await service().storage.from('room-music').remove([trackPath])
})

/** Seen failing on CI only: what each person sees in the room. */
const seen = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[data-testid=room-floor] button')].map((b) => b.getAttribute('aria-label')))

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
  const ben = await signIn(browser, await makeUser('Ben', true))
  // Ben hosts this Virtual Place.
  await service().from('virtual_spaces').update({ created_by: userIds.Ben }).eq('id', roomId).throwOnError()
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
  await expect(ben.getByRole('button', { name: /^Ada/ }))
    .toBeVisible({ timeout: 30_000 })
    .catch(async (e: Error) => {
      const roster = await service().from('virtual_space_participants').select('display_name, last_seen_at, pos_x, pos_y').eq('space_id', roomId)
      const benPage = `${ben.url()} · ${(await ben.locator('body').innerText()).slice(0, 400).replace(/\s+/g, ' ')}`
      throw new Error(
        `${e.message}\nBen sees: ${JSON.stringify(await seen(ben))}\nAda sees: ${JSON.stringify(await seen(ada))}\nRoom: ${JSON.stringify(roster.data)}\nBen's page: ${benPage}\nPage errors: ${JSON.stringify(pageErrors)}`,
      )
    })
  await ben.getByRole('button', { name: /^Ada/ }).click()
  await ben.getByRole('button', { name: /Go talk to Ada/ }).click()
  await expect(ben.getByRole('button', { name: /^Ada/ })).toHaveAttribute('aria-label', /Nearby/, { timeout: 20_000 })
  await ben.getByRole('button', { name: /^Ada/ }).click()
  const card = ben.getByRole('dialog', { name: /^Ada/ })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Add friend' }).click()
  await expect(ben.getByRole('button', { name: 'Friends' })).toHaveAttribute('aria-pressed', 'true')
  await expect(ben.getByText(/Ada is in your friends/)).toBeVisible()
  await ben.keyboard.press('Escape')

  // Ben's own bubble: a status note Ada sees, a bigger bubble, and his talking circle hidden.
  const benBubble = ada.getByRole('button', { name: /^Ben/ })
  const before = (await benBubble.boundingBox())!.width
  await ben.getByRole('button', { name: /^You:/ }).click()
  const mine = ben.getByRole('dialog', { name: 'Your bubble' })
  await mine.getByLabel('Status on your bubble').fill('Heads down until 3')
  await mine.getByRole('button', { name: 'Set' }).click()
  await expect(ada.getByTestId('bubble-status').filter({ hasText: 'Heads down until 3' })).toBeVisible()
  await mine.getByRole('button', { name: 'Bigger bubble' }).click()
  await mine.getByRole('button', { name: 'Bigger bubble' }).click()
  await expect.poll(async () => (await benBubble.boundingBox())!.width, { timeout: 15_000 }).toBeGreaterThan(before * 1.2)
  await expect(ben.getByTestId('talk-ring')).toBeVisible()
  await mine.getByRole('switch', { name: 'Show my talking circle' }).uncheck()
  await expect(ben.getByTestId('talk-ring')).toHaveCount(0)

  // Music from the PLACES library: Ada (no Pass) can listen but not choose; Ben (PLACES Pass) plays a track for the room.
  trackPath = `test-${run}.wav`
  await service().storage.from('room-music').upload(trackPath, silentWav(), { contentType: 'audio/wav' })
  const url = service().storage.from('room-music').getPublicUrl(trackPath).data.publicUrl
  const { data: track } = await service()
    .from('room_tracks')
    .insert({ title: `Quiet Focus ${run % 10000}`, artist: 'PLACES', license: 'test', path: trackPath, url, duration_s: 3 })
    .select('id')
    .single()
    .throwOnError()
  trackId = track!.id
  await ada.getByRole('button', { name: /^Music/ }).click()
  await expect(ada.getByRole('dialog', { name: 'Music' })).toContainText('PLACES Pass members can play music')
  await ben.getByRole('button', { name: /^Music/ }).click()
  await ben.getByRole('dialog', { name: 'Music' }).getByRole('button', { name: new RegExp(`Quiet Focus ${run % 10000}`) }).click()
  await expect(ben.getByTestId('music-player')).toContainText(`Quiet Focus ${run % 10000}`)
  const player = ben.getByTestId('music-player').locator('audio')
  await expect(player).toHaveAttribute('src', url)
  await player.evaluate((el) => ((el as HTMLAudioElement & { placesMark?: number }).placesMark = 1))
  await expect(ada.getByRole('dialog', { name: 'Music' })).toContainText('Playing in the room', { timeout: 15_000 })
  await expect(ada.getByRole('button', { name: 'Music (playing)' })).toBeVisible()
  await ada.getByRole('dialog', { name: 'Music' }).getByRole('switch', { name: 'Listen' }).click()
  await expect(ada.getByTestId('music-player').locator('audio')).toHaveAttribute('src', url)
  await ada.getByRole('button', { name: 'Close music' }).click()

  // Ben, the host, changes the room's background from inside it; Ada sees it change. Ada can't change it.
  await expect(ada.getByRole('toolbar', { name: 'Room controls' }).getByRole('button', { name: 'Background' })).toHaveCount(0)
  await ben.getByRole('toolbar', { name: 'Room controls' }).getByRole('button', { name: 'Background' }).click()
  const scene = ben.getByRole('dialog', { name: 'Background' })
  await scene.getByRole('button', { name: 'Seaside market' }).click()
  await expect(ada.locator('img[src*="marketplace-banner"]').first()).toBeAttached({ timeout: 15_000 })
  await scene.getByTestId('room-background-input').setInputFiles('tests/e2e/room-background.jpg')
  await expect(scene.getByRole('button', { name: 'Your photo' })).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })
  await expect(ada.locator('img[src*="virtual-space-backgrounds"]').first()).toBeAttached({ timeout: 15_000 })
  const row = await service().from('virtual_spaces').select('background_style, background_path').eq('id', roomId).single()
  expect(row.data).toMatchObject({ background_style: 'custom' })
  expect(row.data!.background_path).toMatch(new RegExp(`^${roomId}/`))

  // All that time the room kept updating around Ben's music, and the player was never replaced.
  expect(await player.evaluate((el) => (el as HTMLAudioElement & { placesMark?: number }).placesMark)).toBe(1)
})
