// Generates the PWA icons (a simple football on the app's navy background)
// without any image dependencies — writes PNGs directly. Run once:
//   node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length)
  return out
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function pentagon(cx, cy, r, rotation = -Math.PI / 2) {
  return Array.from({ length: 5 }, (_, i) => {
    const a = rotation + (i * 2 * Math.PI) / 5
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })
}

function inPolygon(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const BG = [15, 23, 42] // #0f172a
const WHITE = [245, 247, 250]
const DARK = [17, 24, 39] // #111827

function drawIcon(size) {
  const c = size / 2
  const ballR = size * 0.36
  const center = pentagon(c, c, size * 0.13)
  const spots = Array.from({ length: 5 }, (_, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5 + Math.PI / 5
    return pentagon(c + size * 0.3 * Math.cos(a), c + size * 0.3 * Math.sin(a), size * 0.085, a)
  })
  const rgba = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c)
      let px = BG
      if (d <= ballR) {
        px = WHITE
        if (d >= ballR - size * 0.015) px = DARK // outline ring
        else if (inPolygon(x, y, center) || spots.some((s) => inPolygon(x, y, s))) px = DARK
      }
      const o = (y * size + x) * 4
      rgba[o] = px[0]
      rgba[o + 1] = px[1]
      rgba[o + 2] = px[2]
      rgba[o + 3] = 255
    }
  }
  return encodePng(size, rgba)
}

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(pub, { recursive: true })
writeFileSync(join(pub, 'icon-512.png'), drawIcon(512))
writeFileSync(join(pub, 'icon-192.png'), drawIcon(192))
writeFileSync(join(pub, 'apple-touch-icon.png'), drawIcon(180))
console.log('Wrote icon-512.png, icon-192.png, apple-touch-icon.png to public/')
