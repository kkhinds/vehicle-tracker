// QA harness — launches the built Electron app via playwright._electron,
// walks every route in src/App.tsx, and captures evidence
// (annotated screenshots, console messages, page errors, unhandled rejections,
// nav-link presence). Output goes to .gstack/qa-reports/.
//
// Run: node scripts/qa-harness.mjs

import { _electron as electron } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTES = [
  { hash: '#/dashboard', name: 'dashboard' },
  { hash: '#/fuel', name: 'fuel' },
  { hash: '#/maintenance', name: 'maintenance' },
  { hash: '#/schedule', name: 'schedule' },
  { hash: '#/insurance', name: 'insurance' },
  { hash: '#/expenses', name: 'expenses' },
  { hash: '#/notes', name: 'notes' },
  { hash: '#/settings', name: 'settings' },
]

const REPORT_DIR = resolve('.gstack/qa-reports')
const SHOTS = resolve(REPORT_DIR, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

const findings = {
  startedAt: new Date().toISOString(),
  routes: [],
  errors: [],
}

const app = await electron.launch({
  args: ['.'],
  timeout: 30000,
})

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')

const consoleMessages = []
const pageErrors = []

page.on('console', (msg) => {
  consoleMessages.push({
    type: msg.type(),
    text: msg.text(),
    url: page.url(),
    ts: Date.now(),
  })
})
page.on('pageerror', (err) => {
  pageErrors.push({
    message: err.message,
    stack: err.stack,
    url: page.url(),
    ts: Date.now(),
  })
})

// Give the app a beat to settle after initial load
await page.waitForTimeout(800)

for (const route of ROUTES) {
  const before = { consoleCount: consoleMessages.length, errorCount: pageErrors.length }

  await page.evaluate((hash) => {
    window.location.hash = hash
  }, route.hash)
  // Wait for hash to apply + React to render
  await page.waitForTimeout(600)

  const url = page.url()
  const title = await page.title()

  // Read the rendered text of <main> so we can detect empty/error states
  const mainText = await page.evaluate(() => {
    const m = document.querySelector('main')
    return m ? (m.textContent || '').trim().slice(0, 2000) : ''
  })

  const headings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h1, h2'))
      .map((h) => h.textContent?.trim())
      .filter(Boolean)
      .slice(0, 10)
  })

  // Nav link presence — confirms sidebar didn't break
  const navLinkCount = await page.evaluate(() => {
    return document.querySelectorAll('aside a').length
  })

  const shotPath = resolve(SHOTS, `${route.name}.png`)
  await page.screenshot({ path: shotPath, fullPage: true })

  const newConsole = consoleMessages.slice(before.consoleCount)
  const newErrors = pageErrors.slice(before.errorCount)

  findings.routes.push({
    name: route.name,
    hash: route.hash,
    url,
    title,
    headings,
    navLinkCount,
    mainPreview: mainText.slice(0, 400),
    consoleNew: newConsole,
    pageErrorsNew: newErrors,
    screenshot: shotPath,
  })
}

findings.endedAt = new Date().toISOString()
findings.totalConsoleMessages = consoleMessages.length
findings.totalPageErrors = pageErrors.length
findings.allConsole = consoleMessages
findings.allPageErrors = pageErrors

writeFileSync(resolve(REPORT_DIR, 'findings.json'), JSON.stringify(findings, null, 2))

await app.close()
console.log(`OK — ${ROUTES.length} routes walked. Output: ${REPORT_DIR}/findings.json`)
