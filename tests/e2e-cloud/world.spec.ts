/**
 * The shared world, end to end, with two real people on two devices (see playwright.cloud.config.ts).
 * Everything here goes through Supabase: what one person makes, the other sees; the database enforces the rules.
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

/** Opens a page and waits until it shows the member signed in (the world has loaded). */
async function go(page: Page, path: string) {
  // Like a person waiting for "Saving…" to clear before closing or reloading the page.
  await page.waitForFunction(() => !document.documentElement.dataset.saving, null, { timeout: 15_000 }).catch(() => {})
  await page.goto(path)
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible({ timeout: 15_000 })
}

async function join(page: Page, name: string, username: string) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Join PLACES' }).filter({ visible: true }).first().click()
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(`${username}@places.test`)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create my place' }).click()
  await expect(page.getByText(`Welcome to PLACES, ${name.split(' ')[0]}!`)).toBeVisible()
}

async function signIn(page: Page, username: string) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Sign in' }).filter({ visible: true }).first().click()
  await page.getByLabel('Email').fill(`${username}@places.test`)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(page.getByText('Signed in.')).toBeVisible()
}

test('two people share one world: posts, shops, orders, jobs, workrooms and messages', async ({ browser }) => {
  test.setTimeout(180_000)
  const rosa = await newDevice(browser)
  const theo = await newDevice(browser)
  const r = `rosa_${run}`
  const t = `theo_${run}`

  await join(rosa.page, 'Rosa Rivera', r)
  await join(theo.page, 'Theo Tran', t)

  // Rosa posts; Theo sees it live, likes and comments.
  await go(rosa.page, 'yourplace/')
  await rosa.page.getByPlaceholder("What's on your mind?").first().fill(`Hello shared world ${run}`)
  await rosa.page.getByRole('button', { name: 'Post', exact: true }).first().click()
  await expect(rosa.page.getByText(`Hello shared world ${run}`)).toBeVisible()

  await go(theo.page, 'people/?u=' + r)
  await expect(theo.page.getByText(`Hello shared world ${run}`)).toBeVisible({ timeout: 15_000 })
  const post = theo.page.locator('article', { hasText: `Hello shared world ${run}` }).first()
  await post.getByRole('button', { name: /^Like/ }).click()
  await expect(post.getByRole('button', { name: /^Like/ })).toHaveAttribute('aria-pressed', 'true')
  await post.getByRole('button', { name: /^Comments/ }).click()
  await post.getByLabel('Write a comment').fill('Welcome, neighbour!')
  await post.getByLabel('Write a comment').press('Enter')
  await expect(theo.page.getByText('Welcome, neighbour!')).toBeVisible()

  // The database tells Rosa (a notification she didn't have to be online for).
  await go(rosa.page, 'notifications/')
  await expect(rosa.page.getByText('Someone commented on your post.')).toBeVisible({ timeout: 15_000 })

  // Rosa opens a shop with a photo; the photo lands in Storage, not the database.
  await go(rosa.page, 'marketplace/')
  await rosa.page.getByRole('button', { name: '+ Sell something' }).filter({ visible: true }).first().click()
  await rosa.page.getByLabel('Shop name').fill(`Rosa's Studio ${run}`)
  await rosa.page.getByRole('button', { name: 'Open my shop' }).click()
  await rosa.page.locator('[role=dialog] input[type=file]').setInputFiles('tests/e2e/fixture.png')
  await expect(rosa.page.getByRole('img', { name: 'Selected image' })).toBeVisible()
  await rosa.page.getByLabel('Product name').fill(`Clay Bowl ${run}`)
  await rosa.page.getByLabel('Price (USD)').fill('30')
  await rosa.page.getByRole('button', { name: 'List product' }).click()
  await expect(rosa.page).toHaveURL(/marketplace\/product\/\?id=prd_/)
  const productUrl = rosa.page.url()
  const productId = new globalThis.URL(productUrl).searchParams.get('id')!
  await expect
    .poll(async () => (await service().from('products').select('image').eq('id', productId).maybeSingle()).data?.image ?? '', { timeout: 15_000 })
    .toMatch(/\/storage\/v1\/object\/public\/media\//)

  // Theo buys it (test order). The database sets the price, and Rosa sees the sale.
  await go(theo.page, productUrl)
  await expect(theo.page.getByRole('heading', { name: `Clay Bowl ${run}` })).toBeVisible({ timeout: 15_000 })
  await theo.page.getByRole('button', { name: 'Place a test order' }).click()
  await expect(theo.page.getByText(/Test order placed/)).toBeVisible()
  await expect.poll(async () => (await service().from('orders').select('total, fee').eq('product_id', productId)).data?.[0] ?? null, { timeout: 15_000 }).toEqual({ total: 3000, fee: 0 })
  await go(rosa.page, 'activity/')
  await rosa.page.getByRole('tab', { name: 'Selling & hiring' }).click()
  await expect(rosa.page.getByText(`Clay Bowl ${run}`).first()).toBeVisible({ timeout: 15_000 })
  await expect(rosa.page.getByText('Theo Tran').first()).toBeVisible()

  // Theo messages Rosa about the bowl; she reads it on her device.
  await go(theo.page, productUrl)
  await theo.page.getByRole('button', { name: /Message Rosa/ }).click()
  await expect(theo.page).toHaveURL(/messages\/\?t=/)
  await theo.page.getByLabel('Write a message').fill('Does it come in blue?')
  await theo.page.getByLabel('Write a message').press('Enter')
  await expect(theo.page.getByText('Does it come in blue?').filter({ visible: true }).first()).toBeVisible()
  await go(rosa.page, 'messages/')
  await expect(rosa.page.getByText('Does it come in blue?').first()).toBeVisible({ timeout: 15_000 })

  // Rosa posts a job; Theo applies; Rosa hires him into a workroom.
  await go(rosa.page, 'workplace/')
  await rosa.page.getByRole('button', { name: '+ Post an opportunity' }).filter({ visible: true }).first().click()
  await rosa.page.getByLabel('Title').fill(`Glaze assistant ${run}`)
  await rosa.page.getByLabel('Description').fill('Help mix glazes and pack orders two mornings a week.')
  await rosa.page.getByRole('button', { name: /Post opportunity · \$2/ }).click()
  await expect(rosa.page).toHaveURL(/opportunity\/\?id=opp_/)
  const oppUrl = rosa.page.url()

  await go(theo.page, oppUrl)
  await theo.page.getByLabel('Why you’re a great fit').fill('I have packed hundreds of pottery orders with care.')
  await theo.page.getByRole('button', { name: 'Send application' }).click()
  await expect(theo.page.getByText('You applied')).toBeVisible()

  await go(rosa.page, oppUrl)
  await rosa.page.getByRole('button', { name: 'Hire' }).click({ timeout: 15_000 })
  await expect(rosa.page).toHaveURL(/workroom\/\?id=wrk_/)
  const roomUrl = rosa.page.url()
  await rosa.page.getByLabel('Message #general').fill('Welcome aboard, Theo!')
  await rosa.page.getByLabel('Message #general').press('Enter')

  // Theo finds his workroom — with the guide's welcome, written by the database.
  await go(theo.page, roomUrl)
  await expect(theo.page.getByText('Welcome aboard, Theo!')).toBeVisible({ timeout: 15_000 })
  await expect(theo.page.getByText(/Welcome to your workroom for/)).toBeVisible()
  await theo.page.getByLabel('Amount (USD)').fill('120')
  await theo.page.getByLabel('For', { exact: true }).fill('First two mornings')
  await theo.page.getByRole('button', { name: 'Request payment' }).click()
  await expect(theo.page.getByText('First two mornings')).toBeVisible()

  await go(rosa.page, roomUrl)
  await rosa.page.getByRole('button', { name: 'Mark as paid' }).click({ timeout: 15_000 })
  await expect(rosa.page.getByText('Marked as paid.')).toBeVisible()
  await go(theo.page, 'notifications/')
  await expect(theo.page.getByText(/You were paid for Glaze assistant/)).toBeVisible({ timeout: 15_000 })

  // A new device: Rosa signs in elsewhere and everything is there.
  const laptop = await newDevice(browser)
  await signIn(laptop.page, r)
  await go(laptop.page, 'yourplace/')
  await expect(laptop.page.getByText(`Hello shared world ${run}`)).toBeVisible()
  await go(laptop.page, 'workrooms/')
  await expect(laptop.page.getByText(`Glaze assistant ${run}`).first()).toBeVisible()

  expect([...rosa.errors, ...theo.errors, ...laptop.errors]).toEqual([])
})

test('the database, not the browser, decides what people may change', async () => {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } })
  const email = `mallory_${run}@places.test`
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: 'Mallory', username: `mallory_${run}` } } })
  expect(error).toBeNull()
  const me = data.user!.id

  // Profile was created by the database, with a welcome message from the guide.
  const profile = await sb.from('profiles').select('username, name').eq('id', me).single()
  expect(profile.data).toEqual({ username: `mallory_${run}`, name: 'Mallory' })
  const welcome = await sb.from('messages').select('sender_id, body')
  expect(welcome.data?.some((m) => m.sender_id === 'p_guide')).toBe(true)

  // Can't edit, delete or impersonate others' things.
  expect((await sb.from('posts').update({ body: 'hacked' }).eq('id', 'post_1').select()).data).toEqual([])
  expect((await sb.from('posts').delete().eq('id', 'post_1').select()).data).toEqual([])
  expect((await sb.from('posts').insert({ id: `post_x${run}`, author_id: 'p_josie', body: 'fake' })).error).not.toBeNull()
  expect((await sb.from('profiles').update({ name: 'Josie?' }).eq('id', 'p_josie').select()).data).toEqual([])
  // Can't hand themselves reach or counts.
  expect((await sb.from('posts').insert({ id: `post_y${run}`, author_id: me, body: 'hi', base_likes: 9999 })).error).not.toBeNull()
  // Can't send notifications or set their own order price.
  expect((await sb.from('notifications').insert({ user_id: 'p_josie', text: 'spam' })).error).not.toBeNull()
  const order = await sb.from('orders').insert({ id: `ord_${run}`, product_id: 'prd_mug', buyer_id: me, via: 'test', total: 1 })
  expect(order.error).not.toBeNull()
  // Paid lessons stay locked; publishing needs a creator plan.
  const locked = await sb.from('lesson_bodies').select('lesson_id').eq('course_id', 'crs_shop')
  expect(locked.data?.map((l) => l.lesson_id)).toEqual(['shp_l1']) // the free preview only
  expect((await sb.from('courses').insert({ id: `crs_${run}`, expert_id: me, title: 'Free stuff', image: '/x.webp', kind: 'course' })).error).not.toBeNull()
  // Can't enrol in a paid course without buying it.
  expect((await sb.from('enrollments').insert({ user_id: me, course_id: 'crs_shop' })).error).not.toBeNull()
  // Can't read other people's conversations or orders.
  expect((await sb.from('orders').select('id').neq('buyer_id', me)).data).toEqual([])
  // Can't join someone else's conversation by knowing its id.
  const { data: others } = await service().from('threads').select('id').neq('created_by', me).limit(1)
  expect((await sb.from('thread_participants').insert({ thread_id: others![0].id, user_id: me })).error).not.toBeNull()
  // Can't store image data in the database.
  expect((await sb.from('posts').insert({ id: `post_z${run}`, author_id: me, body: 'x', image: 'data:image/png;base64,AAAA' })).error).not.toBeNull()

  // Deleting the account removes it and everything it made.
  expect((await sb.from('posts').insert({ id: `post_m${run}`, author_id: me, body: 'Mine' })).error).toBeNull()
  expect((await sb.rpc('delete_my_account')).error).toBeNull()
  expect((await service().from('profiles').select('id').eq('id', me)).data).toEqual([])
  expect((await service().from('posts').select('id').eq('id', `post_m${run}`)).data).toEqual([])
})
