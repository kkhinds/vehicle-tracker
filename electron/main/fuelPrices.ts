import { BrowserWindow, ipcMain } from 'electron'
import { getSetting, setSetting } from './db'
import { parseAnnouncement, parseFeed, priceCandidates, toPlainText, type FeedItem } from './fuelPricesParse'

/**
 * Pump prices, used as a sanity check against what you type in.
 *
 * The app never depends on this: fuel entries are whatever you paid, and the
 * price per litre is worked out from your own litres and total. This is only
 * here to catch a fat-fingered figure, and to answer "what is fuel this month".
 *
 * Two sources, in order:
 *
 * 1. The Barbados Government Information Service. Prices here are set by
 *    government and announced the day they take effect — "Gasoline will retail
 *    at $4.01 per litre and diesel at $3.21 per litre" — so this gives both the
 *    real figure and the date it actually started, which is worth the prose
 *    parsing. Pump prices often hold for months while only cooking gas moves,
 *    so the search walks back until it finds a post naming both fuels.
 * 2. globalpetrolprices.com, for every other country and whenever the first
 *    source can't be read. Its date is when the site looked, not when the price
 *    changed.
 *
 * Checked on every launch. The result is cached in settings, so a failed or
 * slow fetch leaves the last known figure in place and the app carries on.
 */

export interface PumpPrices {
  /** Local currency per litre, or null when the source didn't list that fuel. */
  gasoline: number | null
  diesel: number | null
  /** When the price started (announcement) or was read (scrape), yyyy-MM-dd. */
  priceDate: string | null
  /** True when priceDate is the day the price actually changed. */
  effective: boolean
  country: string
  /** When this app last read the source. */
  checkedAt: string
  source: string
  /** Who published it, for the line under the field. */
  sourceName: string
}

const CACHE_KEY = 'pump_prices'
const DEFAULT_COUNTRY = 'Barbados'
const UA = 'VehicleTracker/1.0 (personal fuel log)'
const TIMEOUT_MS = 12_000

function country(): string {
  return getSetting('pump_price_country') ?? DEFAULT_COUNTRY
}

function get(url: string): Promise<Response> {
  return fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) })
}

/* ── Source 1: Barbados government announcements ─────────────────────────── */

async function fetchBarbadosPrices(): Promise<PumpPrices | null> {
  try {
    const seen = new Map<string, FeedItem>()
    for (const q of ['gasoline', 'petroleum']) {
      const res = await get(`https://gisbarbados.gov.bb/feed/?s=${q}`)
      if (!res.ok) continue
      for (const item of parseFeed(await res.text())) seen.set(item.link, item)
    }

    for (const item of priceCandidates([...seen.values()])) {
      const res = await get(item.link)
      if (!res.ok) continue
      const found = parseAnnouncement(toPlainText(await res.text()))
      if (!found) continue
      return {
        gasoline: found.gasoline,
        diesel: found.diesel,
        priceDate: new Date(item.date).toISOString().slice(0, 10),
        effective: true,
        country: 'Barbados',
        checkedAt: new Date().toISOString(),
        source: item.link,
        sourceName: 'Barbados Government Information Service',
      }
    }
    return null
  } catch {
    return null
  }
}

/* ── Source 2: globalpetrolprices.com ────────────────────────────────────── */

/**
 * One row per fuel in a plain table:
 *
 *   <a class="indicatorName" href='/Barbados/diesel_prices/'>Diesel prices</a>
 *   <td class="value"> 27.07.2026 </td>
 *   <td class="value"> 3.21 </td>      ← local currency per litre
 *   <td class="value"> 1.595 </td>     ← USD per litre
 */
function sourceUrl(c: string): string {
  return `https://www.globalpetrolprices.com/${encodeURIComponent(c)}/`
}

/** "27.07.2026" → "2026-07-27". Returns null on anything unexpected. */
function toIso(ddmmyyyy: string): string | null {
  const m = ddmmyyyy.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function parseFuel(html: string, c: string, fuel: 'gasoline' | 'diesel'):
  { price: number; date: string | null } | null {
  const anchor = html.indexOf(`/${c}/${fuel}_prices/`)
  if (anchor === -1) return null

  const cells = [...html.slice(anchor, anchor + 1200)
    .matchAll(/<td class="value">\s*([^<]+?)\s*<\/td>/g)].map(m => m[1])
  if (cells.length < 2) return null

  const price = parseFloat(cells[1])
  if (!Number.isFinite(price) || price <= 0) return null
  return { price, date: toIso(cells[0]) }
}

async function fetchGlobalPrices(): Promise<PumpPrices | null> {
  const c = country()
  const url = sourceUrl(c)
  try {
    const res = await get(url)
    if (!res.ok) return null
    const html = await res.text()

    const gasoline = parseFuel(html, c, 'gasoline')
    const diesel = parseFuel(html, c, 'diesel')
    if (!gasoline && !diesel) return null

    return {
      gasoline: gasoline?.price ?? null,
      diesel: diesel?.price ?? null,
      priceDate: gasoline?.date ?? diesel?.date ?? null,
      effective: false,
      country: c,
      checkedAt: new Date().toISOString(),
      source: url,
      sourceName: 'globalpetrolprices.com',
    }
  } catch {
    return null
  }
}

/* ── Cache and handlers ──────────────────────────────────────────────────── */

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
  const prices = (country() === DEFAULT_COUNTRY ? await fetchBarbadosPrices() : null)
    ?? await fetchGlobalPrices()
  if (!prices) return null

  setSetting(CACHE_KEY, JSON.stringify(prices))
  // The launch fetch can finish after a window is already showing a form, so
  // the new figure is pushed rather than waiting to be asked for again.
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('fuelPrices:updated', prices)
  }
  return prices
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
