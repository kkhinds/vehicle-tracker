/**
 * Self-check for the pump-price parsers. Run it directly:
 *   node electron/main/fuelPrices.test.ts
 * Fixtures are the real wording from gisbarbados.gov.bb posts.
 */
import assert from 'node:assert/strict'
import { parseAnnouncement, parseFeed, priceCandidates, toPlainText } from './fuelPricesParse.ts'

// The May 2026 announcement — the one setting the price in force today.
const may = toPlainText(`<p>The retail prices of gasoline, diesel, and kerosene will increase
  effective midnight, Sunday, May&#160;17. <strong>Gasoline</strong> will retail at $4.01 per litre
  and diesel at $3.21 per litre, representing increases of 28 cents and six cents,
  respectively. The price of kerosene will move to $2.56 per litre.</p>`)
assert.deepEqual(parseAnnouncement(may), { gasoline: 4.01, diesel: 3.21 })

// March 2026 — a decrease, same sentence shape.
const march = toPlainText(`<p>Gasoline will retail at $3.73 per litre and diesel at $3.15 per
  litre, representing decreases of six cents and 12 cents, respectively.</p>`)
assert.deepEqual(parseAnnouncement(march), { gasoline: 3.73, diesel: 3.15 })

// Cooking gas only: no pump figures, so this post must not be mistaken for one.
const lpg = toPlainText(`<p>Effective midnight, the price of liquefied petroleum gas will fall.
  The 100 lb cylinder will sell at $160.39 and the 25 lb cylinder at $45.20.</p>`)
assert.equal(parseAnnouncement(lpg), null)

// One fuel alone isn't enough to trust the other.
assert.equal(parseAnnouncement('Gasoline will retail at $4.01 per litre.'), null)

// Entities and tags are stripped before matching.
assert.ok(toPlainText('<p>Gasoline&#160;&#8211; $4.01</p>').includes('Gasoline - $4.01'))

// Feed parsing keeps only usable items.
const xml = `<rss><channel>
  <item><title>Reduction In Liquefied Petroleum Gas Prices</title>
    <link>https://x/lpg</link><pubDate>Sun, 02 Aug 2026 10:00:00 +0000</pubDate></item>
  <item><title>Price Increase Of Some Petroleum Products For May 2026</title>
    <link>https://x/may</link><pubDate>Sun, 17 May 2026 22:00:00 +0000</pubDate></item>
  <item><title>Glaucoma - The Silent Thief Of Sight</title>
    <link>https://x/eyes</link><pubDate>Mon, 30 Mar 2026 10:00:00 +0000</pubDate></item>
  <item><title>No link here</title><pubDate>Mon, 30 Mar 2026 10:00:00 +0000</pubDate></item>
</channel></rss>`
const items = parseFeed(xml)
assert.equal(items.length, 3, 'the item without a link is dropped')

const ranked = priceCandidates(items)
assert.deepEqual(ranked.map(i => i.link), ['https://x/lpg', 'https://x/may'])
assert.ok(!ranked.some(i => i.link === 'https://x/eyes'), 'unrelated posts are filtered out')

// Newest first matters: the walk stops at the first post naming both fuels, so
// an LPG-only August post must be tried before the May one that still stands.
assert.equal(ranked[0].link, 'https://x/lpg')

console.log('fuelPrices: all checks passed')
