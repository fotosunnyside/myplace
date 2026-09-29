import { expect, test, type Page } from '@playwright/test'

/** Give IndexedDB a beat to finish before hard navigations. */
const settle = (page: Page) => page.waitForTimeout(350)
const visible = (page: Page, name: string | RegExp) => page.getByRole('button', { name }).filter({ visible: true }).first()

test('a person can join and use every Place', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  const username = `tester_${info.project.name}`

  // Home renders the world
  await page.goto('./')
  await expect(page.locator('img[alt^="An illustrated"]').filter({ visible: true }).first()).toBeVisible()

  // Join
  await page.goto('yourplace/')
  await visible(page, 'Join PLACES').click()
  await page.getByLabel('Your name').fill('Test Person')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(`${username}@example.com`)
  await page.getByRole('button', { name: 'Create my place' }).click()
  await expect(page.getByText('Welcome to PLACES, Test!')).toBeVisible()

  // YourPlace: post
  await page.getByPlaceholder("What's on your mind?").first().fill('Hello from the journey test')
  await page.getByRole('button', { name: 'Post', exact: true }).first().click()
  await expect(page.getByText('Hello from the journey test')).toBeVisible()
  await settle(page)

  // MindPlace: learn + reply
  await page.goto('mindplace/course/?id=crs_sustainable')
  await page.getByRole('button', { name: 'Start learning — free' }).click()
  await page.getByRole('button', { name: /Mark “Start with one habit” as done/ }).click()
  await expect(page.getByText('1 of 4 lessons complete')).toBeVisible()
  await settle(page)
  await page.goto('mindplace/discussion/?id=dsc_2')
  await page.getByLabel('Write a reply').fill('Start with three products and great photos.')
  await page.getByRole('button', { name: 'Post reply' }).click()
  await expect(page.getByText('Start with three products and great photos.')).toBeVisible()
  await settle(page)

  // MarketPlace: open a shop and list a product
  await page.goto('marketplace/')
  await visible(page, '+ Sell something').click()
  await page.getByLabel('Shop name').fill('Test Studio')
  await page.getByRole('button', { name: 'Open my shop' }).click()
  await page.locator('[role=dialog] input[type=file]').setInputFiles('tests/e2e/fixture.png')
  await expect(page.getByRole('img', { name: 'Selected image' })).toBeVisible()
  await page.getByLabel('Product name').fill('Coral Print')
  await page.getByLabel('Price (USD)').fill('24')
  await page.getByRole('button', { name: 'List product' }).click()
  await expect(page).toHaveURL(/marketplace\/product\/\?id=prd_/)
  await expect(page.getByRole('heading', { name: 'Coral Print' })).toBeVisible()
  await settle(page)

  // Buy something (test order) and see it in Activity
  await page.goto('marketplace/product/?id=prd_mug')
  await page.getByRole('button', { name: 'Place a test order' }).click()
  await expect(page.getByText(/Test order placed/)).toBeVisible()
  await settle(page)
  await page.goto('activity/')
  await expect(page.getByText('Ceramic Mug Set')).toBeVisible()

  // WorkPlace: apply
  await page.goto('workplace/opportunity/?id=opp_2')
  await page.getByLabel('Why you’re a great fit').fill('I am organised, kind and love tidy inboxes.')
  await page.getByRole('button', { name: 'Send application' }).click()
  await expect(page.getByText('You applied')).toBeVisible()
  await settle(page)

  // Message a seller
  await page.goto('marketplace/product/?id=prd_hanger')
  await page.getByRole('button', { name: /Message Maya/ }).click()
  await expect(page).toHaveURL(/messages\/\?t=/)
  await page.getByLabel('Write a message').fill('Is this available in blue?')
  await page.getByLabel('Write a message').press('Enter')
  await expect(page.getByText('Is this available in blue?').filter({ visible: true }).first()).toBeVisible()
  await settle(page)

  // Search across the world
  await page.goto('search/?q=ceramic')
  await expect(page.getByText('Ceramic Mug Set').first()).toBeVisible()

  // Everything survives a reload
  await page.goto('yourplace/')
  await page.reload()
  await expect(page.getByText('Hello from the journey test')).toBeVisible()

  // Delete the account
  await page.goto('settings/')
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page).toHaveURL(/\/myplace\/$/)

  expect(errors).toEqual([])
})

test('district labels fly into their Place', async ({ page }) => {
  await page.goto('./')
  const label = page.locator('a[aria-label^="Enter WorkPlace"]').filter({ visible: true }).first()
  await label.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(300)
  const box = (await label.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page).toHaveURL(/workplace\/?$/)
  await expect(page.getByRole('heading', { name: 'WorkPlace' })).toBeVisible()
})

test('a creator can publish a paid course with Create in MindPlace and a learner can unlock it', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  const username = `creator_${info.project.name}`

  // Create a course → the choice: $7/month per course, or PLACES Pass.
  await page.goto('teach/')
  await expect(page.getByRole('button', { name: 'Get PLACES Pass' })).toBeVisible()
  await page.getByRole('button', { name: 'Publish for $7/month' }).click()
  await page.getByLabel('Your name').fill('Cora Creator')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(`${username}@example.com`)
  await page.getByRole('button', { name: 'Create my place' }).click()
  await expect(page.getByText('Test Create in MindPlace plan started.')).toBeVisible()
  await expect(page).toHaveURL(/teach\/course\/?$/)
  await expect(page.getByRole('dialog')).toHaveCount(0) // the join dialog has closed

  await page.locator('input[type=file]').first().setInputFiles('tests/e2e/fixture.png')
  await expect(page.getByRole('img', { name: 'Selected image' })).toBeVisible()
  await page.getByLabel('Title', { exact: true }).fill('Watercolor Basics')
  await page.getByRole('radio', { name: /One-time purchase/ }).click()
  await page.getByLabel('Price (USD)').fill('19')
  await expect(page.getByText(/5% platform fee on each paid enrollment/)).toBeVisible()
  await page.getByLabel('Lesson title').fill('Materials')
  await page.getByLabel('Lesson content').fill('Brushes, paper and three paints.')
  await page.getByRole('button', { name: 'Add lesson' }).click()
  await page.getByLabel('Lesson title').nth(1).fill('First wash')
  await page.getByLabel('Lesson content').nth(1).fill('Wet the paper and let the colour flow.')
  await page.getByRole('button', { name: 'Publish course' }).click()
  await expect(page).toHaveURL(/mindplace\/course\/\?id=crs_/)
  await expect(page.getByRole('heading', { name: 'Watercolor Basics' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Edit your course/ })).toBeVisible()
  const courseUrl = page.url()
  await page.waitForTimeout(350)

  // A second person buys it
  await page.goto('settings/')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByText('Signed out.')).toBeVisible()
  await settle(page)
  await page.goto(courseUrl)
  await page.getByRole('button', { name: /Get course · \$19/ }).click()
  await page.getByLabel('Your name').fill('Lee Learner')
  await page.getByLabel('Username').fill(`learner_${info.project.name}`)
  await page.getByLabel('Email').fill(`learner_${info.project.name}@example.com`)
  await page.getByRole('button', { name: 'Create my place' }).click()
  // Joining resumes the purchase they started
  await expect(page.getByText(/Test purchase complete/)).toBeVisible()
  await expect(page.getByLabel('Locked')).toHaveCount(0)
  await page.getByRole('button', { name: /Mark “First wash” as done/ }).click()
  await expect(page.getByText('1 of 2 lessons complete')).toBeVisible()

  expect(errors).toEqual([])
})

async function join(page: Page, name: string, username: string) {
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(`${username}@example.com`)
  await page.getByRole('button', { name: 'Create my place' }).click()
}

async function switchTo(page: Page, username: string) {
  await page.goto('settings/')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByText('Signed out.')).toBeVisible()
  await settle(page)
  await page.goto('yourplace/')
  await visible(page, 'Join PLACES').click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await page.getByLabel('Email').fill(`${username}@example.com`)
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(page.getByText('Signed in.')).toBeVisible()
  await settle(page)
}

test('an employer can post, hire into a workroom and pay an invoice', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  const boss = `boss_${info.project.name}`
  const pro = `pro_${info.project.name}`

  // Employer posts an opportunity (test mode, normally $2)
  await page.goto('workplace/')
  await visible(page, '+ Post an opportunity').click()
  await join(page, 'Bea Boss', boss)
  await page.getByLabel('Title').fill('Logo design')
  await page.getByLabel('Description').fill('A friendly logo for our small studio, with two rounds of changes.')
  await page.getByRole('button', { name: /Post opportunity · \$2/ }).click()
  await expect(page).toHaveURL(/opportunity\/\?id=opp_/)
  const oppUrl = page.url()
  await page.waitForTimeout(350)

  // A freelancer applies
  await page.goto('settings/')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByText('Signed out.')).toBeVisible()
  await settle(page)
  await page.goto(oppUrl)
  await page.getByLabel('Why you’re a great fit').fill('I have designed logos for twenty small shops.')
  await page.getByRole('button', { name: 'Send application' }).click()
  await join(page, 'Pat Pro', pro)
  await expect(page.getByText('You applied')).toBeVisible()
  await page.waitForTimeout(350)

  // Employer hires → workroom
  await switchTo(page, boss)
  await page.goto(oppUrl)
  await page.getByRole('button', { name: 'Hire' }).click()
  await expect(page).toHaveURL(/workroom\/\?id=wrk_/)
  await page.getByLabel('Message #general').fill('Welcome aboard, Pat!')
  await page.getByLabel('Message #general').press('Enter')
  await expect(page.getByText('Welcome aboard, Pat!')).toBeVisible()
  const roomUrl = page.url()
  await page.waitForTimeout(350)

  // Freelancer requests payment
  await switchTo(page, pro)
  await page.goto(roomUrl)
  await expect(page.getByText('Welcome aboard, Pat!')).toBeVisible()
  await page.getByLabel('Amount (USD)').fill('300')
  await page.getByLabel('For', { exact: true }).fill('Logo, final files')
  await page.getByRole('button', { name: 'Request payment' }).click()
  await expect(page.getByText('Logo, final files')).toBeVisible()
  await page.waitForTimeout(350)

  // Employer marks it paid
  await switchTo(page, boss)
  await page.goto(roomUrl)
  await page.getByRole('button', { name: 'Mark as paid' }).click()
  await expect(page.getByText('Marked as paid.')).toBeVisible()

  expect(errors).toEqual([])
})

test('a business can book the sponsored banner in a Place', async ({ page }, info) => {
  page.on('dialog', (d) => d.accept())
  await page.goto('advertise/?place=mindplace')
  await page.getByLabel('Business name').fill('Candle Co')
  await page.getByLabel('Headline').fill('Small-batch candles for calm evenings')
  await page.getByLabel('Link').fill('https://candle.example')
  await page.locator('input[type=file]').setInputFiles('tests/e2e/fixture.png')
  await expect(page.getByRole('img', { name: 'Selected image' })).toBeVisible()
  await page.getByRole('button', { name: /Book my banner/ }).click()
  await join(page, 'Cal Candle', `candle_${info.project.name}`)
  await expect(page.getByText('Test ad booked.')).toBeVisible()
  await page.waitForTimeout(350)
  await page.goto('mindplace/')
  await expect(page.getByRole('link', { name: /Sponsored: Candle Co/ })).toBeVisible()

  // In YourPlace the sponsored spot sits at the bottom, and once in the feed like a post.
  await page.goto('advertise/?place=yourplace')
  await page.getByLabel('Business name').fill('Candle Co')
  await page.getByLabel('Headline').fill('Small-batch candles for calm evenings')
  await page.getByLabel('Link').fill('https://candle.example')
  await page.locator('input[type=file]').setInputFiles('tests/e2e/fixture.png')
  await page.getByRole('button', { name: /Book my banner · \$10/ }).click()
  await expect(page.getByText('Test ad booked.')).toBeVisible()
  await page.waitForTimeout(350)
  await page.goto('yourplace/')
  await expect(page.getByRole('link', { name: /Sponsored post: Candle Co/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Sponsored: Candle Co/ })).toBeVisible()
})

test('PLACES Pass: one Pass for posting, publishing and hosting — and the menu keeps each Place in its place', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  const desktop = !info.project.name.includes('phone')

  if (desktop) {
    await page.goto('./')
    const nav = page.getByRole('navigation', { name: 'Primary' })
    for (const place of ['YourPlace', 'MindPlace', 'MarketPlace', 'WorkPlace']) await expect(nav.getByRole('link', { name: place, exact: true })).toBeVisible()
  }

  // The pricing page compares Free with the Pass.
  await page.goto('pricing/')
  await expect(page.getByRole('heading', { name: /Free to explore\. Free to belong\./ })).toBeVisible()
  const publishRow = page.getByRole('row', { name: /Publish a course or membership/ })
  await expect(publishRow).toContainText('$7/mo each')
  await expect(publishRow).toContainText('Included')
  await expect(page.getByRole('row', { name: /Shipped MarketPlace transaction/ })).toContainText('1%')
  await expect(page.getByRole('row', { name: /Sponsored placements/ })).toContainText('$10/week')

  await page.getByRole('button', { name: 'Get PLACES Pass' }).first().click()
  await join(page, 'Pia Pass', `pass_${info.project.name}`)
  await expect(page.getByText('Test PLACES Pass started.')).toBeVisible()
  await expect(page.getByText('Your PLACES Pass is active')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your plans' })).toBeVisible()

  // Posting an opportunity is included.
  await page.goto('workplace/')
  await visible(page, '+ Post an opportunity').click()
  await page.getByLabel('Title').fill('Studio assistant')
  await page.getByLabel('Description').fill('Help run our studio two mornings a week.')
  await page.getByRole('button', { name: 'Post opportunity · Included with PLACES Pass' }).click()
  await expect(page).toHaveURL(/opportunity\/\?id=opp_/)

  // So is hosting a space of your own.
  await page.goto('myplace/')
  await page.getByRole('button', { name: 'Make your own room' }).click()
  await page.getByLabel('Room name').fill('Writers Circle')
  await page.getByRole('button', { name: 'Open my room' }).click()
  await expect(page).toHaveURL(/myplace\/space\/\?room=writers-circle-/)
  await page.goto('myplace/')
  await expect(page.getByRole('heading', { name: 'Your spaces' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Writers Circle' })).toBeVisible()

  // A website on the profile.
  await page.goto('settings/')
  await page.getByLabel('Website').fill('piapass.studio')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Profile saved.')).toBeVisible()
  await page.goto('yourplace/')
  await expect(page.getByRole('link', { name: 'piapass.studio' }).first()).toHaveAttribute('href', 'https://piapass.studio')

  // Orders (MarketPlace) and Applications (WorkPlace) are separate — and live rooms aren't in the menu.
  if (desktop) {
    await page.getByRole('button', { name: 'Account menu' }).click()
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: /^Orders/ })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /Live spaces/ })).toHaveCount(0)
    await menu.getByRole('menuitem', { name: /^Applications/ }).click()
    await expect(page).toHaveURL(/activity\/\?tab=applications/)
    await expect(page.getByRole('tab', { name: 'Applications' })).toHaveAttribute('aria-selected', 'true')
  }
  expect(errors).toEqual([])
})

test('YourPlace leads into a live space', async ({ page, context }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await context.grantPermissions(['camera', 'microphone'])

  // The official rooms are small squares under the profile panel — not a section taking over YourPlace.
  await page.goto('yourplace/')
  await expect(page.getByRole('button', { name: 'Go to Accountability Department' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Live Spaces' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Go to Town Hall' }).click()
  await page.getByLabel('Your name').fill('Room Tester')
  await page.getByLabel('Username').fill(`rooms_${info.project.name}`)
  await page.getByLabel('Email').fill(`rooms_${info.project.name}@example.com`)
  await page.getByRole('button', { name: 'Create my place' }).click()

  // Straight into the room, as a bubble, with honest media status.
  await expect(page).toHaveURL(/\/myplace\/space\/\?room=town-hall/)
  await expect(page.getByRole('toolbar', { name: 'Room controls' })).toBeVisible()
  await expect(page.getByTestId('room-count')).toHaveText('1 person here')
  await expect(page.getByRole('button', { name: /^You:/ })).toBeVisible()
  await expect(page.getByTestId('media-note')).toBeVisible()

  // Mic and camera toggle.
  const mic = page.getByRole('toolbar', { name: 'Room controls' }).getByRole('button', { name: /Mute|Unmute/ })
  const before = await mic.getAttribute('aria-pressed')
  await mic.click()
  await expect(mic).not.toHaveAttribute('aria-pressed', before!)

  // The count is the real one.
  await page.getByRole('link', { name: /Spaces/ }).first().click()
  await expect(page.getByRole('region', { name: /You're in Town Hall/ })).toBeVisible()
  await expect(page.getByTestId('space-count').first()).toHaveText('1 person here')
  await expect(page.getByText('Come in. Meet people. Talk about what’s happening around PLACES.')).toBeVisible()

  // The Accountability Department greets you and starts quiet.
  await page.goto('myplace/space/?room=accountability-room')
  await page.getByRole('button', { name: 'Start Working' }).click()
  await expect(page.getByText('Bring something you need to finish. Work quietly alongside other people and get it done.')).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Room controls' }).getByRole('button', { name: 'Unmute' })).toBeVisible()

  await page.getByRole('button', { name: 'Leave' }).click()
  await expect(page).toHaveURL(/\/myplace\/$/)
  await expect(page.getByTestId('space-count').first()).toHaveText('No one here yet')

  // No admin tools without the backend and an admin account.
  await page.goto('admin/spaces/')
  await expect(page.getByText('Admin needs the PLACES backend')).toBeVisible()
  expect(errors).toEqual([])
})

test('a guest drops into the Accountability Department with just a name', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await context.grantPermissions(['camera', 'microphone'])

  // The short link to share (e.g. in a Skool community) goes straight to the door: a name, no account.
  await page.goto('accountability/')
  await expect(page).toHaveURL(/myplace\/space\/\?room=accountability-room/)
  await page.getByLabel('Your name').fill('Sky Guest')
  await page.getByRole('button', { name: 'Drop in' }).click()
  await expect(page.getByRole('toolbar', { name: 'Room controls' })).toBeVisible()
  await expect(page.getByTestId('room-count')).toHaveText('1 person here')
  await expect(page.getByText('You’re here as a guest.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^You:/ })).toBeVisible()

  // Other rooms are for members: a guest is asked to join.
  await page.getByRole('button', { name: 'Leave' }).click()
  await page.goto('myplace/space/?room=town-hall')
  await expect(page.getByRole('button', { name: 'Join PLACES' }).last()).toBeVisible()

  // "Make your own room" sits under the rooms on YourPlace.
  await page.goto('yourplace/')
  await expect(page.getByRole('link', { name: 'Make your own room' })).toBeVisible()
  expect(errors).toEqual([])
})
