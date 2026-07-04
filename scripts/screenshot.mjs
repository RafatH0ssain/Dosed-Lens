/**
 * Reliable headless screenshot via Chrome DevTools Protocol.
 * Usage: node scripts/screenshot.mjs <url> <out.png> [waitMs] [width] [height]
 *
 * Unlike `chrome --screenshot --virtual-time-budget=N` (which needs N ms of
 * *rendered frames* and dies silently under SwiftShader load), this waits in
 * real time and asks for the capture explicitly. Also the M6 calibration
 * driver: loop it over substances × tiers.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , url, out, waitMsArg, wArg, hArg] = process.argv;
if (!url || !out) {
  console.error('usage: node scripts/screenshot.mjs <url> <out.png> [waitMs] [w] [h]');
  process.exit(1);
}
const waitMs = Number(waitMsArg ?? 8000);
const W = Number(wArg ?? 1280);
const H = Number(hArg ?? 720);

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const { existsSync } = await import('node:fs');
const chromeBin = CHROME_PATHS.find((p) => existsSync(p));
if (!chromeBin) { console.error('no chrome/edge found'); process.exit(1); }

const port = 9500 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'dl-cdp-'));
const chrome = spawn(chromeBin, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`,
  `--window-size=${W},${H}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

const die = (code) => {
  try { chrome.kill('SIGKILL'); } catch {}
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch {} ; process.exit(code); }, 300);
};

// wait for the debugger endpoint
let version = null;
for (let i = 0; i < 50 && !version; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {}
}
if (!version) { console.error('chrome debugger never came up'); die(1); }

// open the page as a new tab
const tab = await (await fetch(
  `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
  { method: 'PUT' },
)).json();

const ws = new WebSocket(tab.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
};
ws.onerror = () => { console.error('ws error'); die(1); };

await new Promise((r) => (ws.onopen = r));
await send('Page.enable');
// let the app boot, load its image, and animate in real time
await new Promise((r) => setTimeout(r, waitMs));
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(`wrote ${out} (${shot.data.length * 0.75 | 0} bytes approx)`);
ws.close();
die(0);
