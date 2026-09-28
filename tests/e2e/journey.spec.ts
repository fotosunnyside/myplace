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

test('a creator can subscribe, publish a paid course and a learner can unlock it', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  const username = `creator_${info.project.name}`

  await page.goto('teach/')
  await page.getByRole('button', { name: 'Start teaching' }).click()
  await page.getByLabel('Your name').fill('Cora Creator')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(`${username}@example.com`)
  await page.getByRole('button', { name: 'Create my place' }).click()
  await expect(page.getByText('Test creator plan started.')).toBeVisible()
  await expect(page.getByText('Your first course is waiting.')).toBeVisible()

  await page.getByRole('link', { name: 'Create a course' }).click()
  await page.locator('input[type=file]').first().setInputFiles('tests/e2e/fixture.png')
  await expect(page.getByRole('img', { name: 'Selected image' })).toBeVisible()
  await page.getByLabel('Title', { exact: true }).fill('Watercolor Basics')
  await page.getByRole('radio', { name: /Paid/ }).click()
  await page.getByLabel('Price (USD)').fill('19')
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
