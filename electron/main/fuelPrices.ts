import { BrowserWindow, ipcMain } from 'electron'
import { getSetting, setSetting } from './db'

/**
 * National pump prices, used as a sanity check against what you type in.
 *
 * The app never depends on this: fuel entries are whatever you paid, and the
 * price per litre is worked out from your own litres and total. This is only
 * here to catch a fat-fingered figure, and to answer "what is fuel this month".
 *
 * globalpetrolprices.com publishes one row per fuel in a plain table:
 *
 *   <a class="indicatorName" href='/Barbados/diesel_prices/'>Diesel prices</a>
 *   <td class="value"> 27.07.2026 </td>
 *   <td class="value"> 3.21 </td>      ← local currency per litre
 *   <td class="value"> 1.595 </td>     ← USD per litre
 *
 * Every launch checks for a new price. The result is cached in settings, so a
 * failed or slow fetch just leaves the last known figure in place and the app
 * carries on — it works fine offline, only with an older comparison.
 */

export interface PumpPrices {
  /** Local currency per litre, or null when the page didn't list that fuel. */
  gasoline: number | null
  diesel: number | null
  /** The date the site published, yyyy-MM-dd. */
  priceDate: string | null
  country: string
  /** When this app last read the page. */
  checkedAt: string
  source: string
}

const CACHE_KEY = 'pump_prices'
const DEFAULT_COUNTRY = 'Barbados'

function country(): string {
  return getSetting('pump_price_country') ?? DEFAULT_COUNTRY
}

function sourceUrl(c: string): string {
  return `https://www.globalpetrolprices.com/${encodeURIComponent(c)}/`
}

/** "27.07.2026" → "2026-07-27". Returns null on anything unexpected. */
function toIso(ddmmyyyy: string): string | null {
  const m = ddmmyyyy.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/** Pulls the row for one fuel out of the page. */
function parseFuel(html: string, c: string, fuel: 'gasoline' | 'diesel'):
  { price: number; date: string | null } | null {
  const anchor = html.indexOf(`/${c}/${fuel}_prices/`)
  if (anchor === -1) return null

  // The three <td class="value"> cells after the anchor are date, local, USD.
  const cells = [...html.slice(anchor, anchor + 1200)
    .matchAll(/<td class="value">\s*([^<]+?)\s*<\/td>/g)].map(m => m[1])
  if (cells.length < 2) return null

  const price = parseFloat(cells[1])
  if (!Number.isFinite(price) || price <= 0) return null
  return { price, date: toIso(cells[0]) }
}

export function getCachedPumpPrices(): PumpPrices | null {
  const raw = getSetting(CACHE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PumpPrices
  } catch {
    return null
  }
}

/** Fetches and caches. Returns null on any network or parsing failure. */
export async function fetchPumpPrices(): Promise<PumpPrices | null> {
  const c = country()
  const url = sourceUrl(c)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VehicleTracker/1.0 (personal fuel log)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const html = await res.text()

    const gasoline = parseFuel(html, c, 'gasoline')
    const diesel = parseFuel(html, c, 'diesel')
    if (!gasoline && !diesel) return null

    const prices: PumpPrices = {
      gasoline: gasoline?.price ?? null,
      diesel: diesel?.price ?? null,
      priceDate: gasoline?.date ?? diesel?.date ?? null,
      country: c,
      checkedAt: new Date().toISOString(),
      source: url,
    }
    setSetting(CACHE_KEY, JSON.stringify(prices))
    // The launch fetch can finish after a window is already showing a form, so
    // the new figure is pushed rather than waiting to be asked for again.
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('fuelPrices:updated', prices)
    }
    return prices
  } catch {
    return null
  }
}

/**
 * Called once per launch. The old cache stays put if this fails, so the worst
 * case is the comparison being a few days behind rather than absent.
 */
export async function refreshPumpPrices(): Promise<void> {
  await fetchPumpPrices()
}

export function registerFuelPriceHandlers(): void {
  ipcMain.handle('fuelPrices:get', () => getCachedPumpPrices())
  ipcMain.handle('fuelPrices:refresh', () => fetchPumpPrices())
}
