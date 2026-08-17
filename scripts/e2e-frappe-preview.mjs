import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const target = process.env.TARGET_URL || 'https://frappe-supabase-preview.kislms-frappe.pages.dev'
const outputDir = 'output/playwright/frappe-preview'
const browserCourseId = `frappe-browser-${Date.now()}`
mkdirSync(outputDir, { recursive: true })

const password = (service, account) => execFileSync(
  'security', ['find-generic-password', '-w', '-s', service, '-a', account],
  { encoding: 'utf8' },
).trim()

const accounts = {
  employee: {
    email: 'frappe.employee.e2e@kislms.site',
    password: password('kislms-frappe-e2e-employee', 'frappe.employee.e2e@kislms.site'),
  },
  hr: {
    email: 'frappe.hr.e2e@kislms.site',
    password: password('kislms-frappe-e2e-hr', 'frappe.hr.e2e@kislms.site'),
  },
}

const failures = []
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})

async function createPage(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`http ${response.status()}: ${response.url()}`)
  })
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))
  return { context, page }
}

async function login(page, account) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(`${target}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      break
    } catch (error) {
      if (attempt === 1) throw error
    }
  }
  await page.locator('input[type="email"]').waitFor()
  await page.locator('input[type="email"]').fill(account.email)
  await page.locator('input[autocomplete="current-password"]').fill(account.password)
  await page.locator('button[type="submit"]').click()
  try {
    await page.waitForURL('**/courses')
  } catch (error) {
    const visibleError = await page.locator('[role="alert"]').allTextContents()
    throw new Error(`Login did not reach /courses; url=${page.url()}; alerts=${visibleError.join(' | ')}; diagnostics=${failures.join(' | ')}`, { cause: error })
  }
}

const desktop = await createPage({ width: 1440, height: 1000 })
await login(desktop.page, accounts.employee)
await desktop.page.getByText('Frappe LMS Production Readiness').first().click()
await desktop.page.getByRole('button', { name: 'Enroll now' }).click()
await desktop.page.getByText('Welcome to KIS Learning').click()
await desktop.page.waitForURL('**/lessons/**')
await desktop.page.getByRole('button', { name: /Mark complete|Completed/ }).waitFor()
const incompleteButton = desktop.page.getByRole('button', { name: 'Mark complete' })
if (await incompleteButton.isVisible()) await incompleteButton.click()
await desktop.page.reload({ waitUntil: 'domcontentloaded' })
try {
  await desktop.page.getByRole('button', { name: 'Completed' }).waitFor()
} catch (error) {
  const text = (await desktop.page.locator('body').innerText()).slice(0, 1000)
  throw new Error(`Progress did not render after reload; url=${desktop.page.url()}; body=${text}; diagnostics=${failures.join(' | ')}`, { cause: error })
}
await desktop.page.screenshot({ path: `${outputDir}/employee-lesson.png`, fullPage: true })
await desktop.page.getByRole('button', { name: 'Log out' }).click()
await desktop.page.waitForURL('**/login')
await login(desktop.page, accounts.employee)
await desktop.page.getByText('Frappe LMS Production Readiness').first().waitFor()
await desktop.context.close()

const hr = await createPage({ width: 1440, height: 1000 })
await login(hr.page, accounts.hr)
await hr.page.goto(`${target}/admin`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await hr.page.getByLabel('Course ID').fill(browserCourseId)
await hr.page.getByLabel('Title').fill('Browser Authored Course')
await hr.page.getByLabel('Short description').fill('Created through the production Supabase HR policy')
await hr.page.getByLabel('Category').fill('Compliance')
await hr.page.getByLabel('Published').check()
await hr.page.getByLabel('Allow self enrollment').check()
await hr.page.getByRole('button', { name: 'Save course' }).click()
await hr.page.getByRole('heading', { name: 'Add chapter and lesson' }).waitFor()
await hr.page.getByRole('button', { name: 'Add outline' }).click()
await hr.page.getByText('Chapter and lesson created.').waitFor()
await hr.page.screenshot({ path: `${outputDir}/hr-editor.png`, fullPage: true })
await hr.context.close()

const mobile = await createPage({ width: 390, height: 844 })
await login(mobile.page, accounts.employee)
await mobile.page.getByText('Browser Authored Course').first().click()
await mobile.page.getByText('Introduction').first().waitFor()
await mobile.page.screenshot({ path: `${outputDir}/mobile-course.png`, fullPage: true })
await mobile.context.close()

await browser.close()

if (failures.length) {
  throw new Error(`Browser failures:\n${[...new Set(failures)].join('\n')}`)
}

console.log('Employee desktop persistence PASS; HR authoring PASS; mobile course flow PASS; console/network PASS.')
