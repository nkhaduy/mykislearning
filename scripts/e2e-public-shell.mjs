import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const target = process.env.TARGET_URL || 'http://127.0.0.1:4173'
const outputDir = 'output/playwright/public-shell'
mkdirSync(outputDir, { recursive: true })

const failures = []
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})

async function verifyPage({ path, heading, screenshot, viewport }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`${path} console: ${message.text()}`)
  })
  page.on('pageerror', (error) => failures.push(`${path} pageerror: ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${path} http ${response.status()}: ${response.url()}`)
  })

  await page.goto(`${target}${path}`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.getByRole('heading', { name: heading }).first().waitFor()
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 })
  await page.getByRole('heading', { name: heading }).first().waitFor()
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(320, innerHeight * 0.75)) {
      scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 80))
    }
    scrollTo(0, 0)
  })
  await page.screenshot({ path: `${outputDir}/${screenshot}`, fullPage: true })
  await context.close()
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  const suffix = viewport.width < 500 ? 'mobile' : 'desktop'
  await verifyPage({ path: '/', heading: 'MyKIS Learning', screenshot: `landing-${suffix}.png`, viewport })
  await verifyPage({ path: '/about-kis', heading: 'Về KIS Việt Nam', screenshot: `about-${suffix}.png`, viewport })
  await verifyPage({ path: '/login', heading: 'Đăng nhập', screenshot: `login-${suffix}.png`, viewport })
}

const aliasContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const aliasPage = await aliasContext.newPage()
await aliasPage.goto(`${target}/about`, { waitUntil: 'networkidle', timeout: 60_000 })
if (new URL(aliasPage.url()).pathname !== '/about-kis') failures.push('/about did not redirect to /about-kis')
await aliasContext.close()
await browser.close()

if (failures.length) throw new Error([...new Set(failures)].join('\n'))
console.log('Legacy landing, About KIS, login, responsive layouts, assets, console/network, and SPA refresh PASS.')
