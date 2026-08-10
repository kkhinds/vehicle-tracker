/**
 * Parsing for the pump-price sources, kept apart from the fetching so it can be
 * checked on its own — see fuelPrices.test.ts. No electron, no database.
 */

export interface FeedItem { title: string; link: string; date: string }

/** Strips tags and the entities that turn up in these posts. */
export function toPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pulls the two figures out of an announcement. Both have to be present: a post
 * about cooking gas alone says nothing about the pump.
 */
export function parseAnnouncement(text: string): { gasoline: number; diesel: number } | null {
  const num = (label: string): number | null => {
    const m = text.match(new RegExp(`${label}[^.$]{0,80}\\$\\s?(\\d+\\.\\d{2})`, 'i'))
    const v = m ? parseFloat(m[1]) : NaN
    return Number.isFinite(v) && v > 0 ? v : null
  }
  const gasoline = num('gasoline')
  const diesel = num('diesel')
  return gasoline !== null && diesel !== null ? { gasoline, diesel } : null
}

export function parseFeed(xml: string): FeedItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, body]) => ({
    title: (body.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? '').trim(),
    link: (body.match(/<link>([^<]+)<\/link>/)?.[1] ?? '').trim(),
    date: (body.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? '').trim(),
  })).filter(i => i.link && i.date)
}

/** Announcements worth opening, newest first. */
export function priceCandidates(items: FeedItem[]): FeedItem[] {
  return items
    .filter(i => /price|petroleum|gasoline|diesel|fuel/i.test(i.title))
    .filter(i => !Number.isNaN(Date.parse(i.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 6)
}
