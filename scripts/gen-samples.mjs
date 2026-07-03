/**
 * Generates the six CC0 procedural test images into public/samples/.
 * Zero-dep: hand-rolled PNG encoder (filter 0 + zlib deflate).
 * Scenes are chosen to exercise the pipeline: strong edges (brick), a bright
 * light source (room lamp, street), organic texture (forest), a face-like
 * subject (statue), and a near-featureless field (sky).
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 1280, H = 800;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'samples');
mkdirSync(outDir, { recursive: true });

/* ---------- PNG encoder ---------- */
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
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- helpers ---------- */
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
function hashN(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (
    hashN(xi, yi) * (1 - u) * (1 - v) +
    hashN(xi + 1, yi) * u * (1 - v) +
    hashN(xi, yi + 1) * (1 - u) * v +
    hashN(xi + 1, yi + 1) * u * v
  );
}
function fbm(x, y, oct = 5) {
  let a = 0.5, s = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f);
    f *= 2.03; a *= 0.5;
  }
  return s;
}
function render(name, fn) {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x / W, y / H, x, y);
      const i = (y * W + x) * 3;
      buf[i] = clamp(r); buf[i + 1] = clamp(g); buf[i + 2] = clamp(b);
    }
  }
  writeFileSync(join(outDir, name), encodePNG(buf, W, H));
  console.log('wrote', name);
}

/* ---------- 1. indoor room with lamp ---------- */
render('01-room-lamp.png', (u, v) => {
  const lx = 0.68, ly = 0.38;
  const d = Math.hypot((u - lx) * 1.6, v - ly);
  let r = 26, g = 22, b = 20;
  // wall/floor split
  const floorY = 0.72 + 0.02 * Math.sin(u * 9);
  if (v > floorY) { r = 48; g = 34; b = 24; }
  // wall panelling lines
  if (v < floorY && Math.abs((u * 6) % 1 - 0.5) < 0.012) { r += 14; g += 12; b += 10; }
  // skirting
  if (Math.abs(v - floorY) < 0.008) { r += 30; g += 24; b += 18; }
  // floorboards
  if (v > floorY && Math.abs(((v - floorY) * 14) % 1 - 0.5) < 0.05) { r *= 0.8; g *= 0.8; b *= 0.8; }
  // lamp glow
  const glow = Math.exp(-d * d * 26);
  r += 235 * glow; g += 205 * glow; b += 140 * glow;
  // lampshade (trapezoid) + stand
  const inShade = v > ly - 0.09 && v < ly + 0.02 && Math.abs(u - lx) < 0.055 + (v - ly + 0.09) * 0.35;
  if (inShade) { r = 210 + 30 * (1 - d); g = 160; b = 90; }
  if (Math.abs(u - lx) < 0.006 && v > ly + 0.02 && v < 0.78) { r = 30; g = 26; b = 24; }
  // side table
  if (v > 0.62 && v < 0.64 && u > 0.56 && u < 0.82) { r = 70; g = 48; b = 30; }
  if (v >= 0.64 && v < 0.78 && (Math.abs(u - 0.58) < 0.01 || Math.abs(u - 0.80) < 0.01)) { r = 60; g = 42; b = 26; }
  // picture frame on wall
  if (u > 0.16 && u < 0.34 && v > 0.22 && v < 0.44) {
    const bord = u < 0.175 || u > 0.325 || v < 0.235 || v > 0.425;
    if (bord) { r = 90; g = 74; b = 48; }
    else { r = 40 + 60 * fbm(u * 20, v * 20); g = 50 + 50 * fbm(u * 20 + 9, v * 20); b = 70 + 40 * fbm(u * 20, v * 20 + 5); }
  }
  // window (dark blue night)
  if (u > 0.02 && u < 0.14 && v > 0.18 && v < 0.55) {
    r = 18; g = 22; b = 44;
    if (Math.abs(u - 0.08) < 0.004 || Math.abs(v - 0.365) < 0.004) { r = 34; g = 30; b = 28; }
  }
  const n = fbm(u * 40, v * 40) * 10 - 5;
  return [r + n, g + n, b + n];
});

/* ---------- 2. brick wall ---------- */
render('02-brick-wall.png', (u, v) => {
  const bh = 0.055, bw = 0.16;
  const row = Math.floor(v / bh);
  const off = row % 2 ? bw / 2 : 0;
  const bx = ((u + off) % bw) / bw;
  const by = (v % bh) / bh;
  const mortar = bx < 0.045 || by < 0.09;
  const bidx = Math.floor((u + off) / bw) + row * 31;
  let r, g, b;
  if (mortar) {
    const m = 150 + 26 * fbm(u * 90, v * 90);
    r = m; g = m * 0.97; b = m * 0.9;
  } else {
    const tone = 0.75 + 0.5 * hashN(bidx, row);
    const tex = fbm(u * 70, v * 70) * 34;
    r = (118 + tex) * tone + 20;
    g = (62 + tex * 0.75) * tone;
    b = (48 + tex * 0.6) * tone;
    // chips & pits
    if (vnoise(u * 200, v * 200) > 0.88) { r *= 0.75; g *= 0.75; b *= 0.75; }
  }
  // soft daylight gradient
  const light = 1.06 - 0.28 * v - 0.10 * Math.abs(u - 0.35);
  return [r * light, g * light, b * light];
});

/* ---------- 3. forest ---------- */
render('03-forest.png', (u, v) => {
  let r = 14, g = 26, b = 16;
  // canopy glow
  const sky = Math.max(0, 1 - v * 2.4);
  r += 60 * sky; g += 90 * sky; b += 46 * sky;
  // layered trunks
  for (let i = 0; i < 9; i++) {
    const tx = hashN(i, 7) * 0.96 + 0.02;
    const tw = 0.012 + 0.03 * hashN(i, 3);
    const wob = 0.008 * Math.sin(v * 14 + i * 5);
    const depth = 0.35 + 0.65 * hashN(i, 11);
    if (Math.abs(u - tx - wob) < tw && v > 0.06 * i * 0.04) {
      const bark = fbm(u * 150, v * 30) * 30;
      r = (52 + bark) * depth; g = (40 + bark * 0.8) * depth; b = (30 + bark * 0.6) * depth;
      // moss
      if (vnoise(u * 60, v * 60) > 0.62) { g += 26 * depth; r -= 6; }
    }
  }
  // foliage clumps
  const fol = fbm(u * 9, v * 9 + 40, 6);
  if (fol > 0.52 && v < 0.55) {
    const d = (fol - 0.52) * 3;
    r = 20 + 40 * d; g = 52 + 70 * d; b = 22 + 26 * d;
  }
  // undergrowth
  if (v > 0.82) {
    const gr = fbm(u * 30, v * 30) * 40;
    r = 24 + gr * 0.5; g = 40 + gr; b = 18 + gr * 0.3;
  }
  // light shafts
  const shaft = Math.max(0, Math.sin((u - v * 0.35) * 24)) ** 8 * Math.max(0, 1 - v * 1.3) * 0.5;
  r += 70 * shaft; g += 80 * shaft; b += 50 * shaft;
  return [r, g, b];
});

/* ---------- 4. street at night ---------- */
render('04-street-night.png', (u, v) => {
  let r = 10, g = 10, b = 16;
  // sky gradient
  if (v < 0.45) { b += 18 * (0.45 - v); r += 6 * (0.45 - v); }
  // buildings silhouettes with lit windows
  const bId = Math.floor(u * 7);
  const bTop = 0.16 + 0.24 * hashN(bId, 2);
  if (v > bTop && v < 0.62) {
    r = 16; g = 15; b = 20;
    const wx = (u * 7 * 6) % 1, wy = ((v - bTop) * 18) % 1;
    if (wx > 0.3 && wx < 0.62 && wy > 0.3 && wy < 0.68 && hashN(Math.floor(u * 42), Math.floor((v - bTop) * 18) + bId) > 0.55) {
      r = 224; g = 180; b = 110; // lit window
    }
  }
  // road with perspective dashes
  if (v > 0.62) {
    const road = 22 + fbm(u * 50, v * 50) * 14;
    r = road; g = road; b = road * 1.08;
    const cx = Math.abs(u - 0.5) / (v - 0.55);
    if (cx < 0.02 && ((v * 24) % 1) < 0.5) { r = 180; g = 170; b = 120; }
    // curb
    if (cx > 0.62 && cx < 0.66) { r = 44; g = 44; b = 48; }
  }
  // street lights: poles + bright heads
  for (let i = 0; i < 3; i++) {
    const lx = 0.2 + i * 0.3, ly = 0.42 + i * 0.02;
    const d = Math.hypot((u - lx) * 1.4, v - ly);
    const glow = Math.exp(-d * d * 420) * 255 + Math.exp(-d * d * 40) * 90;
    r += glow; g += glow * 0.88; b += glow * 0.6;
    if (Math.abs(u - lx - 0.014) < 0.0035 && v > ly && v < 0.72) { r = Math.max(r, 26); g = Math.max(g, 26); b = Math.max(b, 30); }
  }
  // car tail-lights
  const d1 = Math.hypot((u - 0.44) * 2, (v - 0.68) * 3);
  const d2 = Math.hypot((u - 0.485) * 2, (v - 0.68) * 3);
  const tail = Math.exp(-d1 * d1 * 3200) + Math.exp(-d2 * d2 * 3200);
  r += 230 * tail; g += 30 * tail; b += 26 * tail;
  return [r, g, b];
});

/* ---------- 5. statue portrait ---------- */
render('05-statue.png', (u, v) => {
  // backdrop gradient
  let r = 44 + 30 * (1 - v) + fbm(u * 6, v * 6) * 14;
  let g = r * 0.96, b = r * 1.04;
  const cx = 0.5, hy = 0.34;
  const dx = u - cx, dy = v - hy;
  // stone tone with subtle veins
  const stone = (sh) => {
    const veins = Math.abs(Math.sin(u * 40 + fbm(u * 12, v * 12) * 8)) < 0.06 ? -12 : 0;
    const t = 168 * sh + fbm(u * 90, v * 90) * 22 + veins;
    return [t, t * 0.97, t * 0.92];
  };
  // head (ellipse) with simple side lighting
  const head = (dx * dx) / (0.115 * 0.115) + (dy * dy) / (0.155 * 0.155);
  // neck + shoulders/bust
  const neck = Math.abs(dx) < 0.045 && v > hy + 0.13 && v < hy + 0.24;
  const bust = v > hy + 0.2 && v < 0.9 && Math.abs(dx) < 0.3 * Math.min(1, (v - hy - 0.2) * 5 + 0.25);
  if (head < 1 || neck || bust) {
    const lightSide = 0.75 + 0.45 * Math.max(0, -dx * 4 + 0.4) * (1 - v * 0.4);
    [r, g, b] = stone(lightSide);
    // facial features as shading dents
    const eL = Math.hypot((dx + 0.045) * 1.6, dy + 0.02);
    const eR = Math.hypot((dx - 0.045) * 1.6, dy + 0.02);
    const nose = Math.hypot(dx * 2.6, dy - 0.045);
    const mouth = Math.hypot(dx * 1.6, dy - 0.095);
    if (head < 1) {
      const dent = Math.exp(-eL * eL * 2600) * 42 + Math.exp(-eR * eR * 2600) * 42 + Math.exp(-mouth * mouth * 3800) * 30;
      r -= dent; g -= dent; b -= dent;
      const ridge = Math.exp(-nose * nose * 4000) * 26;
      r += ridge; g += ridge; b += ridge;
      // brow shadow
      if (dy < -0.03 && dy > -0.075 && Math.abs(dx) < 0.075) { r -= 16; g -= 16; b -= 16; }
    }
  }
  // plinth
  if (v > 0.9) { const p = 92 + fbm(u * 40, v * 40) * 16; r = p; g = p * 0.98; b = p * 0.95; }
  return [r, g, b];
});

/* ---------- 6. plain sky ---------- */
render('06-sky.png', (u, v) => {
  let r = 96 - 40 * v + 10 * u;
  let g = 150 - 44 * v;
  let b = 224 - 46 * v;
  // sun glow upper right
  const d = Math.hypot((u - 0.82) * 1.5, v - 0.16);
  const glow = Math.exp(-d * d * 9);
  r += 120 * glow; g += 96 * glow; b += 40 * glow;
  // two soft clouds
  const c1 = fbm(u * 5 + 3, v * 9, 6) - Math.abs(v - 0.42) * 1.4;
  const c2 = fbm(u * 4 + 40, v * 7 + 9, 6) - Math.abs(v - 0.68) * 1.6;
  const cl = Math.max(0, Math.max(c1 - 0.34, c2 - 0.38)) * 3;
  const cw = Math.min(1, cl);
  r = r * (1 - cw) + (232 - 40 * v) * cw;
  g = g * (1 - cw) + (236 - 34 * v) * cw;
  b = b * (1 - cw) + (242 - 22 * v) * cw;
  return [r, g, b];
});

console.log('done →', outDir);
