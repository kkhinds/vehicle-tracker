/**
 * Generate the Windows icons from the SVG marks in resources/.
 *
 *   logo.svg     → icon.ico + icon-256.png   (shipped app)
 *   logo-dev.svg → icon-dev.ico              (dev build, green road)
 *
 * Run via `npm run icon`. Re-run any time either logo changes.
 *
 * Strategy: render PNGs at 16/24/32/48/64/128/256, pack into ICO.
 *   - @resvg/resvg-js renders SVG → PNG buffer at exact pixel size
 *   - png-to-ico packs PNG buffers into a Windows ICO container
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import toIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const res = (...parts) => resolve(projectRoot, 'resources', ...parts)

// Standard Windows icon sizes. ICO spec caps individual images at 256×256.
const SIZES = [16, 24, 32, 48, 64, 128, 256]

function renderAll(svgPath) {
  const svg = readFileSync(svgPath)
  return SIZES.map(size => {
    const buf = new Resvg(svg, {
      fitTo: { mode: 'width', value: size },
      background: 'rgba(0,0,0,0)',
    }).render().asPng()
    console.log(`  ${size}×${size}  (${buf.length} bytes)`)
    return buf
  })
}

async function build(svgName, icoName, pngName) {
  const svgPath = res(svgName)
  if (!existsSync(svgPath)) {
    console.log(`Skipping ${icoName} — no ${svgName}`)
    return
  }
  console.log(`Rendering ${SIZES.length} sizes from ${svgPath}…`)
  const pngs = renderAll(svgPath)

  if (pngName) {
    // The 256px PNG doubles as the in-browser favicon.
    writeFileSync(res(pngName), pngs[pngs.length - 1])
    console.log(`Wrote PNG: ${res(pngName)}`)
  }

  const ico = await toIco(pngs)
  writeFileSync(res(icoName), ico)
  console.log(`Wrote ICO: ${res(icoName)}  (${ico.length} bytes)`)
}

await build('logo.svg', 'icon.ico', 'icon-256.png')
await build('logo-dev.svg', 'icon-dev.ico')
