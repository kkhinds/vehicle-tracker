/**
 * Generate Windows multi-resolution icon (resources/icon.ico) from resources/logo.svg.
 *
 * Run via `npm run icon`. Re-run any time logo.svg changes.
 *
 * Strategy: render PNGs at 16/24/32/48/64/128/256, pack into ICO.
 *   - @resvg/resvg-js renders SVG → PNG buffer at exact pixel size
 *   - png-to-ico packs PNG buffers into a Windows ICO container
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import toIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const svgPath = resolve(projectRoot, 'resources', 'logo.svg')
const icoPath = resolve(projectRoot, 'resources', 'icon.ico')
const pngPath = resolve(projectRoot, 'resources', 'icon-256.png')

// Standard Windows icon sizes. ICO spec caps individual images at 256×256.
const SIZES = [16, 24, 32, 48, 64, 128, 256]

const svg = readFileSync(svgPath)

function renderPng(sizePx) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: sizePx },
    background: 'rgba(0,0,0,0)',
  })
  return resvg.render().asPng()
}

console.log(`Rendering ${SIZES.length} sizes from ${svgPath}…`)
const pngs = SIZES.map(size => {
  const buf = renderPng(size)
  console.log(`  ${size}×${size}  (${buf.length} bytes)`)
  return buf
})

// Save the 256px PNG separately too — useful for the in-browser favicon
// and any future macOS/.icns work.
writeFileSync(pngPath, pngs[pngs.length - 1])
console.log(`Wrote PNG: ${pngPath}`)

const ico = await toIco(pngs)
writeFileSync(icoPath, ico)
console.log(`Wrote ICO: ${icoPath}  (${ico.length} bytes)`)
