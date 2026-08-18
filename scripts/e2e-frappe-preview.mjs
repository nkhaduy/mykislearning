import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '../frontend/node_modules/@supabase/supabase-js/dist/index.mjs'

const target = process.env.TARGET_URL || 'https://frappe-supabase-preview.kislms-frappe.pages.dev'
const outputDir = 'output/playwright/frappe-preview'
const authoredTitle = `Upstream Authoring E2E ${Date.now()}`
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

async function publicSupabaseConfig() {
  const html = await fetch(target).then((response) => response.text())
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((match) => match[1])
  for (const src of scripts) {
    const bundle = await fetch(new URL(src, target)).then((response) => response.text())
    const url = bundle.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0]
    const key = bundle.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
    if (url && key) return { url, key }
  }
  throw new Error('Could not resolve the deployed public Supabase configuration')
}

const failures = []
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
let authoredCourseId = null

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
  await page.goto(`${target}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('input[type="email"]').fill(account.email)
  await page.locator('input[autocomplete="current-password"]').fill(account.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/courses', { timeout: 60_000 })
}

async function cleanupAuthoredCourse() {
  if (!authoredCourseId) return
  const { url, key } = await publicSupabaseConfig()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: loginError } = await client.auth.signInWithPassword(accounts.hr)
  if (loginError) throw loginError
  const { data: rows, error: selectError } = await client
    .from('courses')
    .select('id,title,short_description')
    .eq('id', authoredCourseId)
  if (selectError) throw selectError
  const exact = rows?.[0]
  if (!exact || exact.title !== authoredTitle || exact.short_description !== 'Created through official upstream authoring UI') {
    throw new Error('Refusing to clean a course that does not match the deterministic E2E fixture')
  }
  const { error: deleteError } = await client.from('courses').delete().eq('id', authoredCourseId)
  if (deleteError) throw deleteError
  await client.auth.signOut()
}

try {
  const hr = await createPage({ width: 1440, height: 1000 })
  await login(hr.page, accounts.hr)
  await hr.page.goto(`${target}/courses?tab=created&newCourse=1`, { waitUntil: 'domcontentloaded' })
  const dialog = hr.page.getByRole('dialog', { name: 'New Course' })
  await dialog.getByLabel('Title').fill(authoredTitle)
  await dialog.getByText('Select instructors').click()
  await hr.page.getByText('Frappe E2E HR', { exact: true }).last().click()
  await dialog.getByLabel('Short introduction').fill('Created through official upstream authoring UI')
  await dialog.locator('[contenteditable="true"]').last().fill('Deterministic upstream authoring test.')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await hr.page.waitForURL(/\/courses\/[0-9a-f-]+#settings/, { timeout: 60_000 })
  authoredCourseId = new URL(hr.page.url()).pathname.split('/').pop()

  await hr.page.getByRole('tab', { name: 'Course editor' }).click()
  await hr.page.getByText('Chapters', { exact: true }).waitFor()
  const addChapterButton = hr.page.getByRole('button', { name: 'Create chapter' })
  await addChapterButton.waitFor()
  await addChapterButton.click()
  try {
    await hr.page.getByText('Add Chapter', { exact: true }).last().waitFor({ timeout: 5000 })
  } catch (error) {
    throw new Error(`Add Chapter dialog did not open: ${(await hr.page.locator('body').innerText()).slice(-2000)}`, { cause: error })
  }
  await hr.page.locator('input:visible').last().fill('Introduction')
  await hr.page.getByRole('button', { name: 'Create', exact: true }).click()
  await hr.page.getByText('Introduction', { exact: true }).click()
  await hr.page.getByRole('button', { name: 'Add Lesson' }).click()
  const lessonTitle = hr.page.getByLabel('Lesson title')
  await lessonTitle.waitFor({ timeout: 60_000 })
  await hr.page.waitForTimeout(2000)
  const lessonSaved = hr.page.waitForResponse((response) =>
    response.request().method() === 'PATCH' && response.url().includes('/rest/v1/lessons')
  , { timeout: 60_000 })
  await lessonTitle.fill('Published lesson')
  await lessonSaved
  await hr.page.getByText('Settings', { exact: true }).click()
  await hr.page.getByRole('button', { name: 'Publish', exact: true }).waitFor({ timeout: 60_000 })
  await hr.page.getByRole('button', { name: 'Publish', exact: true }).click()
  await hr.page.getByText('Published', { exact: true }).waitFor()
  await hr.page.screenshot({ path: `${outputDir}/hr-authoring.png`, fullPage: true })
  await hr.context.close()

  const desktop = await createPage({ width: 1440, height: 1000 })
  await login(desktop.page, accounts.employee)
  await desktop.page.getByText(authoredTitle, { exact: true }).first().click()
  await desktop.page.getByRole('button', { name: /Enroll now/i }).click()
  await desktop.page.waitForURL(/\/courses\/[^/]+\/(learn|lessons)\//)
  await desktop.page.getByRole('heading', { name: 'Published lesson' }).waitFor()
  await desktop.page.getByText(/Completed 100%/i).waitFor({ timeout: 45_000 })
  await desktop.page.reload({ waitUntil: 'domcontentloaded' })
  await desktop.page.getByText(/Completed 100%/i).waitFor()
  await desktop.page.screenshot({ path: `${outputDir}/employee-lesson.png`, fullPage: true })
  await desktop.page.goto(`${target}/courses`, { waitUntil: 'domcontentloaded' })
  const beforeLogout = failures.length
  await desktop.page.getByText('Frappe E2e Employee', { exact: true }).last().click()
  await desktop.page.getByText('Log out', { exact: true }).click()
  await desktop.page.waitForURL('**/login')
  const logoutFailures = failures.splice(beforeLogout)
  failures.push(...logoutFailures.filter((failure) =>
    !/auth\/v1\/user|status of 403|Auth session missing/i.test(failure)
  ))
  await login(desktop.page, accounts.employee)
  await desktop.page.getByText(authoredTitle, { exact: true }).first().waitFor()
  await desktop.context.close()

  const mobile = await createPage({ width: 390, height: 844 })
  await login(mobile.page, accounts.employee)
  await mobile.page.getByText(authoredTitle, { exact: true }).first().click()
  await mobile.page.waitForURL(`**/courses/${authoredCourseId}`)
  await mobile.page.goto(`${target}/courses/${authoredCourseId}/learn/1-1`, { waitUntil: 'domcontentloaded' })
  await mobile.page.getByRole('heading', { name: 'Published lesson' }).waitFor()
  await mobile.page.screenshot({ path: `${outputDir}/mobile-course.png`, fullPage: true })
  await mobile.context.close()
} finally {
  await cleanupAuthoredCourse()
  await browser.close()
}

if (failures.length) throw new Error(`Browser failures:\n${[...new Set(failures)].join('\n')}`)

console.log('Employee persistence PASS; upstream HR authoring/publish PASS; mobile PASS; deterministic cleanup PASS; console/network PASS.')
