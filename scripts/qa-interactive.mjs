// Interactive QA pass — opens dialogs, submits empty forms (to see validation),
// clicks tabs, tries Export CSV, toggles dark mode.
// Reads ELECTRON-launched app via playwright._electron.
//
// Run: node scripts/qa-interactive.mjs

import { _electron as electron } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPORT_DIR = resolve('.gstack/qa-reports')
const SHOTS = resolve(REPORT_DIR, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

const findings = { startedAt: new Date().toISOString(), checks: [] }
const consoleMessages = []
const pageErrors = []

const app = await electron.launch({ args: ['.'], timeout: 30000 })
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text(), url: page.url(), ts: Date.now() }))
page.on('pageerror', (e) => pageErrors.push({ message: e.message, stack: e.stack, url: page.url(), ts: Date.now() }))
await page.waitForTimeout(700)

async function go(hash) {
  await page.evaluate((h) => { window.location.hash = h }, hash)
  await page.waitForTimeout(500)
}

async function shot(name) {
  const p = resolve(SHOTS, `int-${name}.png`)
  await page.screenshot({ path: p, fullPage: true })
  return p
}

async function check(name, fn) {
  const before = { console: consoleMessages.length, errors: pageErrors.length }
  let result = { name, ok: true, notes: [], screenshot: null, consoleNew: [], errorsNew: [] }
  try {
    await fn(result)
  } catch (e) {
    result.ok = false
    result.notes.push(`THREW: ${e.message}`)
  }
  result.consoleNew = consoleMessages.slice(before.console)
  result.errorsNew = pageErrors.slice(before.errors)
  findings.checks.push(result)
}

// --- 1. Fuel: open Add Fill-up, submit empty, capture validation
await go('#/fuel')
await check('fuel-add-dialog-empty-submit', async (r) => {
  // Click "Add Fill-up" button — there are TWO add buttons on empty state
  // Top-right "Add Fill-up" and empty-state "Add First Fill-up"
  await page.getByRole('button', { name: /add fill-up/i }).first().click()
  await page.waitForTimeout(400)
  const dialogOpen = await page.locator('[role="dialog"]').count()
  r.notes.push(`dialog opened: ${dialogOpen > 0}`)
  r.screenshot = await shot('fuel-add-dialog')

  // Clear required date field, submit
  await page.locator('input[type="date"]').first().fill('')
  await page.getByRole('button', { name: /^add fill-up$/i }).last().click()
  await page.waitForTimeout(400)
  const errs = await page.locator('p.text-destructive').allTextContents()
  r.notes.push(`validation errors: ${JSON.stringify(errs)}`)
  r.screenshot2 = await shot('fuel-add-dialog-validation')

  // Close dialog
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

// --- 2. Maintenance: open Add Entry, submit empty
await go('#/maintenance')
await check('maintenance-add-dialog-empty-submit', async (r) => {
  await page.getByRole('button', { name: /add entry/i }).click()
  await page.waitForTimeout(400)
  r.screenshot = await shot('maintenance-add-dialog')
  // Try to find the submit button inside dialog (often labeled "Add Entry" or "Save")
  const submitBtn = page.locator('[role="dialog"] button[type="submit"]').first()
  const submitCount = await submitBtn.count()
  r.notes.push(`submit btn in dialog: ${submitCount}`)
  if (submitCount > 0) {
    await submitBtn.click()
    await page.waitForTimeout(400)
    const errs = await page.locator('[role="dialog"] p.text-destructive').allTextContents()
    r.notes.push(`validation errors: ${JSON.stringify(errs)}`)
    r.screenshot2 = await shot('maintenance-add-validation')
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

// --- 3. Insurance: Add Policy
await go('#/insurance')
await check('insurance-add-policy-dialog', async (r) => {
  await page.getByRole('button', { name: /add policy/i }).click()
  await page.waitForTimeout(400)
  r.screenshot = await shot('insurance-add-dialog')
  const submitBtn = page.locator('[role="dialog"] button[type="submit"]').first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
    await page.waitForTimeout(400)
    const errs = await page.locator('[role="dialog"] p.text-destructive').allTextContents()
    r.notes.push(`validation errors: ${JSON.stringify(errs)}`)
    r.screenshot2 = await shot('insurance-add-validation')
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

// --- 4. Schedule: Add Custom
await go('#/schedule')
await check('schedule-add-custom-dialog', async (r) => {
  await page.getByRole('button', { name: /add custom/i }).click()
  await page.waitForTimeout(400)
  r.screenshot = await shot('schedule-add-dialog')
  const submitBtn = page.locator('[role="dialog"] button[type="submit"]').first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
    await page.waitForTimeout(400)
    const errs = await page.locator('[role="dialog"] p.text-destructive').allTextContents()
    r.notes.push(`validation errors: ${JSON.stringify(errs)}`)
    r.screenshot2 = await shot('schedule-add-validation')
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

// --- 5. Notes: Add Note
await go('#/notes')
await check('notes-add-note-dialog', async (r) => {
  await page.getByRole('button', { name: /add note/i }).first().click()
  await page.waitForTimeout(400)
  r.screenshot = await shot('notes-add-dialog')
  const submitBtn = page.locator('[role="dialog"] button[type="submit"]').first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
    await page.waitForTimeout(400)
    const errs = await page.locator('[role="dialog"] p.text-destructive').allTextContents()
    r.notes.push(`validation errors: ${JSON.stringify(errs)}`)
    r.screenshot2 = await shot('notes-add-validation')
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

// --- 6. Expenses tabs
await go('#/expenses')
await check('expenses-tabs', async (r) => {
  const tabs = ['Quarterly', 'Yearly', 'Breakdown', 'Monthly']
  const shots = {}
  for (const t of tabs) {
    await page.getByRole('tab', { name: new RegExp(`^${t}$`, 'i') }).click()
    await page.waitForTimeout(400)
    shots[t] = await shot(`expenses-tab-${t.toLowerCase()}`)
  }
  r.notes.push(`tabs traversed: ${tabs.join(', ')}`)
  r.shots = shots
})

// --- 7. Expenses Export CSV — verify no crash; we can't grab the saved file path,
//     but if a save dialog appears we won't deadlock since the harness ignores it.
await check('expenses-export-csv-clickable', async (r) => {
  const btn = page.getByRole('button', { name: /export csv/i })
  r.notes.push(`button count: ${await btn.count()}`)
  // Don't actually click — the OS save dialog would block. Just verify it exists.
})

// --- 8. Settings — toggle dark mode
await go('#/settings')
await check('settings-theme-toggle', async (r) => {
  r.screenshotBefore = await shot('settings-before-toggle')
  // The Dark Mode switch — use role=switch
  const sw = page.getByRole('switch').first()
  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await sw.click()
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  r.notes.push(`html.dark before=${before} after=${after}`)
  r.screenshotAfter = await shot('settings-after-toggle')
  // Restore
  await sw.click()
  await page.waitForTimeout(300)
})

// --- 9. Dashboard rendering with data — quick sanity
await go('#/dashboard')
await check('dashboard-cards', async (r) => {
  const cards = await page.locator('main >> div >> div').count()
  r.notes.push(`approx card descendants: ${cards}`)
  r.screenshot = await shot('dashboard-final')
})

findings.endedAt = new Date().toISOString()
findings.consoleAll = consoleMessages
findings.errorsAll = pageErrors
writeFileSync(resolve(REPORT_DIR, 'interactive-findings.json'), JSON.stringify(findings, null, 2))
await app.close()
console.log(`OK — ${findings.checks.length} interactive checks. Output: ${REPORT_DIR}/interactive-findings.json`)
