/**
 * More of the shared world with two people: courses, discussions, follows, saves, collections,
 * profile photos, ads, team workrooms and deleting an account (see playwright.cloud.config.ts).
 */
import { expect, test, type Browser, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_TEST_URL ?? ''
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY ?? ''
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
// Unique per test run (including repeats), so every run gets its own people.
let run = ''
test.beforeEach(() => {
  run = `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`
})
const password = 'correct-horse-battery'

test.skip(!URL || !SERVICE || !ANON, 'Needs a running Supabase stack')

const service = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

async function newDevice(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } })
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  return { page, errors }
}

async function go(page: Page, path: string) {
  // Like a person waiting for "Saving…" to clear before closing or reloading the page.
  await page.waitForFunction(() => !document.documentElement.dataset.saving, null, { timeout: 15_000 }).catch(() => {})
  await page.goto(path)
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible({ timeout: 15_000 })
}

async function fillJoin(page: Page, name: string, username: string) {
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(`${username}@places.test`)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create my place' }).click()
}

const profileId = async (username: string) => (await service().from('profiles').select('id').eq('username', username).single()).data!.id as string

test('courses, discussions and the social layer, shared', async ({ browser }) => {
  test.setTimeout(180_000)
  const cora = await newDevice(browser)
  const lee = await newDevice(browser)
  const c = `cora_${run}`
  const l = `lee_${run}`

  // Cora starts teaching straight from joining (test creator plan) and publishes a paid course.
  await cora.page.goto('teach/')
  await cora.page.getByRole('button', { name: 'Start teaching' }).click()
  await fillJoin(cora.page, 'Cora Creator', c)
  await expect(cora.page.getByText('Test creator plan started.')).toBeVisible({ timeout: 15_000 })
  await cora.page.getByRole('link', { name: 'Create a course' }).click()
  await cora.page.locator('input[type=file]').first().setInputFiles('tests/e2e/fixture.png')
  await expect(cora.page.getByRole('img', { name: 'Selected image' })).toBeVisible()
  await cora.page.getByLabel('Title', { exact: true }).fill(`Watercolor ${run}`)
  await cora.page.getByRole('radio', { name: /Paid/ }).click()
  await cora.page.getByLabel('Price (USD)').fill('19')
  await cora.page.getByLabel('Lesson title').fill('Materials')
  await cora.page.getByLabel('Lesson content').fill('Brushes, paper and three paints.')
  await cora.page.getByRole('button', { name: 'Add lesson' }).click()
  await cora.page.getByLabel('Lesson title').nth(1).fill('First wash')
  await cora.page.getByLabel('Lesson content').nth(1).fill('Wet the paper and let the colour flow.')
  await cora.page.getByRole('button', { name: 'Publish course' }).click()
  await expect(cora.page).toHaveURL(/mindplace\/course\/\?id=crs_/)
  const courseUrl = cora.page.url()
  const courseId = new globalThis.URL(courseUrl).searchParams.get('id')!
  await expect.poll(async () => (await service().from('course_lessons').select('id').eq('course_id', courseId)).data?.length, { timeout: 15_000 }).toBe(2)

  // Lee finds it; the paid lesson is locked for him until he buys it.
  await lee.page.goto(courseUrl)
  await expect(lee.page.getByRole('heading', { name: `Watercolor ${run}` })).toBeVisible({ timeout: 15_000 })
  await lee.page.getByRole('button', { name: /Get course · \$19/ }).click()
  await fillJoin(lee.page, 'Lee Learner', l)
  await expect(lee.page.getByText(/Test purchase complete/)).toBeVisible({ timeout: 15_000 })
  await expect(lee.page.getByLabel('Locked')).toHaveCount(0)
  await lee.page.getByRole('button', { name: /First wash/ }).filter({ hasNotText: 'Mark' }).last().click()
  await expect(lee.page.getByText('Wet the paper and let the colour flow.')).toBeVisible({ timeout: 15_000 }) // served to him now
  await lee.page.getByRole('button', { name: /Mark “First wash” as done/ }).click()
  await expect(lee.page.getByText('1 of 2 lessons complete')).toBeVisible()
  await go(cora.page, 'notifications/')
  await expect(cora.page.getByText(/Someone bought your course Watercolor/)).toBeVisible({ timeout: 15_000 })

  // A discussion and a reply.
  await go(lee.page, 'mindplace/')
  await lee.page.getByRole('button', { name: /Start a discussion/ }).filter({ visible: true }).first().click()
  await lee.page.getByLabel('Title').fill(`Which paper for beginners? ${run}`)
  await lee.page.getByLabel('Details').fill('Cold press or hot press?')
  await lee.page.getByRole('button', { name: 'Start discussion' }).click()
  await expect(lee.page).toHaveURL(/discussion\/\?id=dsc_/)
  const dscUrl = lee.page.url()
  await go(cora.page, dscUrl)
  await cora.page.getByLabel('Write a reply').fill('Cold press — it forgives mistakes.')
  await cora.page.getByRole('button', { name: 'Post reply' }).click()
  await go(lee.page, 'notifications/')
  await expect(lee.page.getByText(/New reply on “Which paper for beginners/)).toBeVisible({ timeout: 15_000 })
  await go(lee.page, dscUrl)
  await expect(lee.page.getByText('Cold press — it forgives mistakes.')).toBeVisible()

  // Follow, save and collect; set a profile photo.
  await go(lee.page, 'people/?u=' + c)
  await lee.page.getByRole('button', { name: 'Follow', exact: true }).click()
  await expect(lee.page.getByRole('button', { name: 'Following', exact: true })).toBeVisible()
  await go(lee.page, 'marketplace/product/?id=prd_mug')
  await lee.page.getByRole('button', { name: 'Save' }).first().click()
  await go(lee.page, 'yourplace/')
  await lee.page.getByRole('button', { name: 'Collections', exact: true }).click()
  await lee.page.getByLabel('New collection name').fill('Studio wishlist')
  await lee.page.getByRole('button', { name: 'Create', exact: true }).click()
  await go(lee.page, 'settings/')
  await lee.page.locator('input[type=file]').first().setInputFiles('tests/e2e/fixture.png')
  await lee.page.getByLabel('Headline').fill('Learning to paint')
  await lee.page.getByRole('button', { name: 'Save changes' }).click()

  const leeId = await profileId(l)
  const coraId = await profileId(c)
  await expect
    .poll(async () => {
      const sb = service()
      const [f, s, col, p] = await Promise.all([
        sb.from('follows').select('followee_id').eq('follower_id', leeId),
        sb.from('saved_items').select('ref_id').eq('user_id', leeId),
        sb.from('collections').select('title').eq('user_id', leeId),
        sb.from('profiles').select('headline, avatar').eq('id', leeId).single(),
      ])
      return { follows: f.data, saved: s.data, collections: col.data, headline: p.data?.headline, avatarInStorage: /\/storage\/v1\/object\/public\/media\//.test(p.data?.avatar ?? '') }
    }, { timeout: 15_000 })
    .toEqual({ follows: [{ followee_id: coraId }], saved: [{ ref_id: 'prd_mug' }], collections: [{ title: 'Studio wishlist' }], headline: 'Learning to paint', avatarInStorage: true })

  // Cora sees her new follower from her own device.
  await go(cora.page, 'people/?u=' + c)
  await expect(cora.page.getByText('Followers').locator('..')).toContainText('1')

  expect([...cora.errors, ...lee.errors]).toEqual([])
})

test('ads, team workrooms and leaving PLACES', async ({ browser }) => {
  test.setTimeout(120_000)
  const kai = await newDevice(browser)
  const mo = await newDevice(browser)
  const k = `kai_${run}`
  const m = `mo_${run}`

  // Mo joins first so Kai can invite them.
  await mo.page.goto('./')
  await mo.page.getByRole('button', { name: 'Join PLACES' }).filter({ visible: true }).first().click()
  await fillJoin(mo.page, 'Mo Maker', m)
  await expect(mo.page.getByText('Welcome to PLACES, Mo!')).toBeVisible()

  // Kai books a banner (test mode); everyone sees it in that Place, scheduled by the database.
  await kai.page.goto('advertise/?place=workplace')
  await kai.page.getByLabel('Business name').fill(`Kai Kites ${run}`)
  await kai.page.getByLabel('Headline').fill('Hand-made kites for windy days')
  await kai.page.getByLabel('Link').fill('https://kites.example')
  await kai.page.locator('input[type=file]').setInputFiles('tests/e2e/fixture.png')
  await expect(kai.page.getByRole('img', { name: 'Selected image' })).toBeVisible()
  await kai.page.getByRole('button', { name: /Book my banner/ }).click()
  await fillJoin(kai.page, 'Kai Kite', k)
  await expect(kai.page.getByText('Test ad booked.')).toBeVisible({ timeout: 15_000 })
  const kaiId = await profileId(k)
  await expect.poll(async () => (await service().from('ads').select('business').eq('owner_id', kaiId)).data?.length, { timeout: 15_000 }).toBe(1)

  // A team workroom: Kai invites Mo by username, they talk.
  await go(kai.page, 'workrooms/')
  await kai.page.getByLabel('New workroom name').fill(`Kite crew ${run}`)
  await kai.page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(kai.page).toHaveURL(/workroom\/\?id=wrk_/)
  const roomUrl = kai.page.url()
  await kai.page.getByLabel('Add a member by username').fill('@' + m)
  await kai.page.getByLabel('Add a member by username').press('Enter')
  await expect(kai.page.getByText('Member added.')).toBeVisible()
  await kai.page.getByLabel('New channel name').fill('designs')
  await kai.page.getByLabel('New channel name').press('Enter')
  await kai.page.getByLabel('Message #designs').fill('Sketches go here')
  await kai.page.getByLabel('Message #designs').press('Enter')

  await go(mo.page, 'notifications/')
  await expect(mo.page.getByText(/You were added to the workroom “Kite crew/)).toBeVisible({ timeout: 15_000 })
  await go(mo.page, roomUrl)
  await mo.page.getByRole('button', { name: /designs/ }).first().click()
  await expect(mo.page.getByText('Sketches go here')).toBeVisible()

  // Kai deletes his account: his profile, ad and room ownership go with it.
  await go(kai.page, 'settings/')
  await kai.page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(kai.page.getByText('Your account was deleted.')).toBeVisible({ timeout: 15_000 })
  await expect.poll(async () => (await service().from('profiles').select('id').eq('id', kaiId)).data?.length, { timeout: 15_000 }).toBe(0)
  expect((await service().from('ads').select('id').eq('owner_id', kaiId)).data).toEqual([])
  const { error } = await createClient(URL, ANON, { auth: { persistSession: false } }).auth.signInWithPassword({ email: `${k}@places.test`, password })
  expect(error).not.toBeNull()

  expect([...kai.errors, ...mo.errors]).toEqual([])
})
