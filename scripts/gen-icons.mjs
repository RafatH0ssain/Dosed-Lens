/**
 * Generates the PWA app icons into public/icons/ — a lime "lens/eye" mark on
 * near-black. Zero-dep: same hand-rolled PNG encoder as gen-samples.mjs.
 * Run: npm run icons
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

/* ---------- PNG encoder (RGB truecolor) ---------- */
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePNG(rgb, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolor
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- icon art: lime lens/eye on near-black ---------- */
const BG = [8, 7, 10];
const LIME = [201, 242, 75];

// smooth disc coverage at distance d for radius r (≈1px antialias)
const disc = (d, r) => Math.max(0, Math.min(1, r + 0.5 - d));

function renderIcon(N, scale) {
  // scale < 1 pads the mark inward (for maskable safe-zone)
  const c = N / 2;
  const outerR = 0.37 * N * scale;
  const ringT = 0.055 * N * scale;
  const irisR = 0.205 * N * scale;
  const pupilR = 0.085 * N * scale;
  const rgb = Buffer.alloc(N * N * 3);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const ring = disc(d, outerR) - disc(d, outerR - ringT);      // aperture ring
      const iris = disc(d, irisR) - disc(d, pupilR);               // iris (with pupil hole)
      const a = Math.max(0, Math.min(1, ring + iris));
      const i = (y * N + x) * 3;
      rgb[i] = Math.round(BG[0] + (LIME[0] - BG[0]) * a);
      rgb[i + 1] = Math.round(BG[1] + (LIME[1] - BG[1]) * a);
      rgb[i + 2] = Math.round(BG[2] + (LIME[2] - BG[2]) * a);
    }
  }
  return encodePNG(rgb, N, N);
}

const icons = [
  ['icon-192.png', 192, 1.0],
  ['icon-512.png', 512, 1.0],
  ['icon-maskable-512.png', 512, 0.72], // padded into the maskable safe zone
  ['apple-touch-icon.png', 180, 1.0],
];
for (const [name, size, scale] of icons) {
  writeFileSync(join(outDir, name), renderIcon(size, scale));
  console.log('wrote', name, `${size}x${size}`);
}
