// Rebuilds home-screen icons from public/icon1024.png.
//
// Why: the previous icons embedded a rounded-rectangle background and had
// internal padding, so iOS double-rounded the corners and the donut looked
// off-center / inset. iOS applies its own rounded mask, so the source PNG
// should be a SQUARE with the artwork filling edge-to-edge on a solid color.
//
// Strategy:
//   1. Crop the donut out of icon1024.png at its known bbox (123..901 in 1036px).
//   2. Place it centered on a solid #EAEBE6 canvas, scaled to ~78% of width.
//   3. Export 180, 192, 512 PNGs and a maskable 512 with extra safe-area inset.
//
// Run: node scripts/build-icons.js

import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')
const SOURCE = path.join(PUBLIC, 'icon1024.png')

// Donut bbox inside icon1024.png (measured)
const SRC = { left: 123, top: 123, width: 779, height: 779 }

// Brand cream background (sampled from the existing rounded-rect interior)
const BG = { r: 234, g: 235, b: 230, alpha: 1 }

// Apple touch icons traditionally fill edge-to-edge. iOS will apply its mask.
const FILL_RATIO = 0.78
// Android maskable icons require a 20% safe zone (40% wide). Make the icon smaller
// so Android masking can crop without clipping the donut.
const MASKABLE_RATIO = 0.60

async function buildIcon(targetSize, outName, fillRatio = FILL_RATIO) {
  const donutPx = Math.round(targetSize * fillRatio)
  const donut = await sharp(SOURCE)
    .extract(SRC)
    .resize(donutPx, donutPx, { fit: 'contain', kernel: 'lanczos3' })
    .png()
    .toBuffer()

  const out = path.join(PUBLIC, outName)
  await sharp({
    create: { width: targetSize, height: targetSize, channels: 4, background: BG },
  })
    .composite([{ input: donut, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`wrote ${outName} (${targetSize}x${targetSize}, donut ${donutPx}px)`)
}

async function main() {
  await buildIcon(180, 'icon180appletouch.png')
  await buildIcon(192, 'icon192.png')
  await buildIcon(512, 'icon512.png')
  await buildIcon(512, 'icon512maskable.png', MASKABLE_RATIO)
}

main().catch(err => { console.error(err); process.exit(1) })
